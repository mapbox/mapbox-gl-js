import {buildingBloomUniformValues, buildingDepthUniformValues, buildingUniformValues} from '../render/program/building_program';
import CullFaceMode from '../../src/gl/cull_face_mode';
import DepthMode from '../../src/gl/depth_mode';
import EXTENT from '../../src/style-spec/data/extent';
import {getCutoffParams} from '../../src/render/cutoff';
import {mat4} from 'gl-matrix';
import StencilMode from '../../src/gl/stencil_mode';
import {getMetersPerPixelAtLatitude} from '../../src/geo/mercator_coordinate';
import {Debug} from '../../src/util/debug';
import {drawGroundEffect as fillExtrusionDrawGroundEffect, GroundEffectProperties, frustumCullShadowCaster, computeFrontCutoffParams} from '../../src/render/draw_fill_extrusion';
import Color from '../../src/style-spec/util/color';
import ColorMode from '../../src/gl/color_mode';
import {PerformanceUtils} from '../../src/util/performance';

import type {BuildingBucket, BuildingGeometry} from '../data/bucket/building_bucket';
import type {OverscaledTileID} from '../../src/source/tile_id';
import type Painter from '../../src/render/painter';
import type BuildingStyleLayer from '../style/style_layer/building_style_layer';
import type SourceCache from '../../src/source/source_cache';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms';

export default draw;

// Reused per-tile; safe to pass directly to uniforms because UniformMatrix4f caches a copy.
const matrixScratch = new Float32Array(16);
const normalMatrixScratch = new Float32Array(16);

interface DrawParams {
    painter: Painter;
    source: SourceCache;
    layer: BuildingStyleLayer;
    coords: Array<OverscaledTileID>;
    defines: Array<DynamicDefinesType>;
    blendMode: Readonly<ColorMode>;
    depthMode: Readonly<DepthMode>;
    opacity: number;
    verticalScale: number;
    facadeEmissiveChance: number;
    facadeAOIntensity: number;
    floodLightIntensity: number;
    floodLightColor: [number, number, number];
    depthOnly?: boolean;
}

function drawTiles(params: DrawParams) {
    const {painter, source, layer, coords} = params;
    let defines = params.defines;
    const context = painter.context;

    const isShadowPass = painter.renderPass === 'shadow';
    const isBloomPass = painter.renderPass === 'light-beam';
    const shadowRenderer = painter.shadowRenderer;

    const metersPerPixel = getMetersPerPixelAtLatitude(painter.transform.center.lat, painter.transform.zoom);

    const cutoffParams = getCutoffParams(painter, layer.paint.get('building-cutoff-fade-range'));
    if (cutoffParams.shouldRenderCutoff) {
        defines = defines.concat('RENDER_CUTOFF');
    }

    const frontCutoffArray = layer.paint.get('building-front-cutoff');
    const frontCutoffEnabled = frontCutoffArray[2] < 1.0 && !painter.terrain;
    const frontCutoffParams = computeFrontCutoffParams(painter.transform.pitch, frontCutoffArray, !!painter.terrain);
    if (frontCutoffEnabled) {
        defines = defines.concat('RENDER_FRONT_CUTOFF');
        painter.maxFrontCutoffRawStart = Math.max(painter.maxFrontCutoffRawStart, frontCutoffArray[0]);
    }

    if (params.floodLightIntensity > 0.0) {
        defines = defines.concat('FLOOD_LIGHT');
    }

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer) as BuildingBucket;
        if (!bucket) {
            continue;
        }

        if (shadowRenderer) {
            const singleCascade = shadowRenderer.getMaxCascadeForTile(coord.toUnwrapped()) === 0;
            if (singleCascade) {
                defines = defines.concat('SHADOWS_SINGLE_CASCADE');
            }
        }

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        let programWithFacades;
        let programWithoutFacades;

        const translated = painter.translatePosMatrix(
            coord.expandedProjMatrix,
            tile,
            [0, 0],
            'map');

        mat4.scale(matrixScratch, translated, [1.0, 1.0, params.verticalScale]);
        const matrix = matrixScratch;

        let uniformValues;

        if (isShadowPass && shadowRenderer) {
            const bucketMaxHeight = bucket.maxHeight * metersPerPixel;
            if (frustumCullShadowCaster(tile.tileID, bucketMaxHeight, painter)) {
                continue;
            }
            const tileShadowPassMatrix = shadowRenderer.calculateShadowPassMatrixFromTile(tile.tileID.toUnwrapped());
            mat4.scale(tileShadowPassMatrix, tileShadowPassMatrix, [1.0, 1.0, params.verticalScale]);

            uniformValues = buildingDepthUniformValues(tileShadowPassMatrix);

            programWithFacades = programWithoutFacades = painter.getOrCreateProgram('buildingDepth',
                {config: programConfiguration, defines, overrideFog: false});
        } else if (!isBloomPass) {

            const tileMatrix = painter.transform.calculatePosMatrix(coord.toUnwrapped(), painter.transform.worldSize);
            mat4.scale(tileMatrix, tileMatrix, [1, 1, params.verticalScale]);

            // For tilespace XY, normals are ZUp. Flip Y to follow tile coordinate system orientation.
            // Take vertical scale into account and convert Z to meters.
            mat4.scale(normalMatrixScratch, tileMatrix, [1, -1, 1.0 / metersPerPixel]);
            mat4.invert(normalMatrixScratch, normalMatrixScratch);
            mat4.transpose(normalMatrixScratch, normalMatrixScratch);
            const normalMatrix = normalMatrixScratch;

            // camera position in the tile coordinates
            const mercCameraPos = painter.transform.getFreeCameraOptions().position;
            const tiles = 1 << coord.canonical.z;
            const cameraPos: [number, number, number] = [
                ((mercCameraPos.x - coord.wrap) * tiles - coord.canonical.x) * EXTENT,
                (mercCameraPos.y * tiles - coord.canonical.y) * EXTENT,
                mercCameraPos.z * tiles * EXTENT
            ];

            uniformValues = buildingUniformValues(matrix, normalMatrix, params.opacity, params.facadeAOIntensity, cameraPos, bucket.tileToMeter, params.facadeEmissiveChance, params.floodLightColor, params.floodLightIntensity, frontCutoffParams);

            programWithoutFacades =  painter.getOrCreateProgram('building',
                {config: programConfiguration, defines, overrideFog: false});

            // Use cheaper non-facade shader for depth-only pass (used by two pass translucent rendering)
            if (params.depthOnly === true) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                programWithFacades = programWithoutFacades;
            } else {
                const facadeDefines = defines.concat(["BUILDING_FAUX_FACADE", "HAS_ATTRIBUTE_a_faux_facade_color_emissive"]);
                programWithFacades =  painter.getOrCreateProgram('building',
                {config: programConfiguration, defines: facadeDefines, overrideFog: false});
            }

            if (shadowRenderer) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                shadowRenderer.setupShadowsFromMatrix(tileMatrix, programWithoutFacades, true);

                if (programWithFacades !== programWithoutFacades) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    shadowRenderer.setupShadowsFromMatrix(tileMatrix, programWithFacades, true);
                }
            }
        } else {
            programWithFacades = programWithoutFacades =  painter.getOrCreateProgram('buildingBloom',
            {config: programConfiguration, defines, overrideFog: false});

            uniformValues = buildingBloomUniformValues(matrix);
        }

        const renderBuilding = (building: BuildingGeometry, program) => {
            if (!isBloomPass) {
                const segments = building.segmentsBucket;
                let dynamicBuffers = [building.layoutNormalBuffer, building.layoutCentroidBuffer, building.layoutColorBuffer, building.layoutFloodLightDataBuffer];
                if (building.layoutFacadePaintBuffer) {
                    dynamicBuffers = dynamicBuffers.concat([building.layoutFacadeDataBuffer, building.layoutFacadeVerticalRangeBuffer, building.layoutFacadePaintBuffer]);
                }
                const stencilMode = StencilMode.disabled;
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                program.draw(painter, context.gl.TRIANGLES, params.depthMode, stencilMode, params.blendMode, isShadowPass ? CullFaceMode.disabled : CullFaceMode.backCW,
                    uniformValues, layer.id, building.layoutVertexBuffer, building.indexBuffer,
                    segments, layer.paint, painter.transform.zoom,
                    programConfiguration, dynamicBuffers);
            } else {
                const bloomGeometry = building.entranceBloom;
                const dynamicBuffers = [bloomGeometry.layoutAttenuationBuffer, bloomGeometry.layoutColorBuffer];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                program.draw(painter, context.gl.TRIANGLES, params.depthMode, StencilMode.disabled, params.blendMode, CullFaceMode.disabled,
                    uniformValues, layer.id, bloomGeometry.layoutVertexBuffer, bloomGeometry.indexBuffer,
                    bloomGeometry.segmentsBucket, layer.paint, painter.transform.zoom,
                    programConfiguration, dynamicBuffers);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        painter.uploadCommonUniforms(context, programWithoutFacades, coord.toUnwrapped(), null, cutoffParams);
        if (bucket.buildingWithoutFacade) {
            renderBuilding(bucket.buildingWithoutFacade, programWithoutFacades);
        }

        if (bucket.buildingWithFacade) {
            if (programWithFacades !== programWithoutFacades) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                painter.uploadCommonUniforms(context, programWithFacades, coord.toUnwrapped(), null, cutoffParams);
            }
            renderBuilding(bucket.buildingWithFacade, programWithFacades);
        }
    }
}

function drawGroundEffect(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, coords: Array<OverscaledTileID>, aoPass: boolean, opacity: number, aoIntensity: number, aoRadius: number, floodLightIntensity: number, floodLightColor: [number, number, number], attenuationFactor: number, replacementActive: boolean, renderNeighbors: boolean, frontCutoffParams?: [number, number, number]) {
    const lerp = (a: number, b: number, t: number) => { return (1 - t) * a + t * b; };

    const gl = painter.context.gl;
    const depthMode = painter.depthModeForSublayer(1, DepthMode.ReadOnly, gl.LEQUAL, true);

    const attenuation = lerp(0.1, 3, attenuationFactor);
    const showOverdraw = painter._showOverdrawInspector;

    const conflateLayer = replacementActive;
    const groundEffectProps = new GroundEffectProperties();

    if (!showOverdraw) {
        // Mark the alpha channel with the DF values (that determine the intensity of the effects). No color is written.
        const stencilSdfPass = new StencilMode({func: gl.ALWAYS, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
        const colorSdfPass = new ColorMode([gl.ONE, gl.ONE, gl.ONE, gl.ONE], Color.transparent, [false, false, false, true], gl.MIN);

        fillExtrusionDrawGroundEffect(groundEffectProps, painter, source, layer, coords, depthMode, stencilSdfPass, colorSdfPass, CullFaceMode.disabled, aoPass, 'sdf', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, false, undefined, frontCutoffParams);
    }

    {
        // Draw the effects.
        const stencilColorPass = showOverdraw ? StencilMode.disabled : new StencilMode({func: gl.EQUAL, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.DECR, gl.DECR);
        const colorColorPass = showOverdraw ? painter.colorModeForRenderPass() : new ColorMode([gl.ONE_MINUS_DST_ALPHA, gl.DST_ALPHA, gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

        fillExtrusionDrawGroundEffect(groundEffectProps, painter, source, layer, coords, depthMode, stencilColorPass, colorColorPass, CullFaceMode.disabled, aoPass, 'color', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, false, undefined, frontCutoffParams);
    }
}

function evaluateBucket(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, coords: Array<OverscaledTileID>) {
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer) as BuildingBucket | null | undefined;
        if (!bucket) {
            continue;
        }
        if (bucket.needsEvaluation()) {
            bucket.uploadUpdatedColorBuffer(painter.context);
        }
    }
}

function updateBuildingReplacementsAndTileBorderVisibility(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, layerIndex: number, layerConflate: boolean, coords: Array<OverscaledTileID>) {
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer) as BuildingBucket;
        if (!bucket) {
            continue;
        }
        if (layerConflate) {
            bucket.updateReplacement(coord, painter.replacementSource, layerIndex);
        }
        bucket.uploadUpdatedIndexBuffer(painter.context);
    }
}

function draw(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, coords: Array<OverscaledTileID>) {
    const perfStartTime = PerformanceUtils.now();

    if (painter.currentLayer < painter.firstLightBeamLayer) {
        painter.firstLightBeamLayer = painter.currentLayer;
    }

    const aoIntensity = layer.paint.get('building-ambient-occlusion-ground-intensity');
    const aoRadius = layer.paint.get('building-ambient-occlusion-ground-radius');
    const aoGroundAttenuation = layer.paint.get('building-ambient-occlusion-ground-attenuation');
    const opacity = layer.paint.get('building-opacity');
    if (opacity <= 0) {
        return;
    }

    let aoEnabled = aoIntensity > 0 && aoRadius > 0;
    let castsShadowsEnabled = true;
    let receiveShadowsEnabled = true;

    let drawLayer = true;

    const verticalScale = layer.paint.get('building-vertical-scale');
    if (verticalScale <= 0) {
        return;
    }

    Debug.run(() => {
        aoEnabled = aoEnabled && painter._debugParams.buildingsDrawGroundAO;
        castsShadowsEnabled = castsShadowsEnabled && painter._debugParams.buildingsDrawShadowPass;
        drawLayer = drawLayer && painter._debugParams.buildingsDrawTranslucentPass;
    });

    if (!painter.shadowRenderer) {
        receiveShadowsEnabled = false;
    }

    // Update building layer conflation and ensure single drawing of features crossing tile borders
    const conflateLayer = painter.conflationActive && painter.style.isLayerClipped(layer, source.getSource());
    const layerIndex = painter.style.order.indexOf(layer.fqid);

    updateBuildingReplacementsAndTileBorderVisibility(painter, source, layer, layerIndex, conflateLayer, coords);

    evaluateBucket(painter, source, layer, coords);

    layer.resetLayerRenderingStats(painter);

    if (painter.shadowRenderer) painter.shadowRenderer.useNormalOffset = true;

    if (painter.renderPass === 'shadow' && painter.shadowRenderer && castsShadowsEnabled) {
        const shadowRenderer = painter.shadowRenderer;
        const definesForPass: Array<DynamicDefinesType> = [
        ];

        const depthMode = shadowRenderer.getShadowPassDepthMode();

        drawTiles({
            painter,
            source,
            layer,
            coords,
            defines: definesForPass,
            blendMode: ColorMode.disabled,
            depthMode,
            opacity,
            verticalScale,
            facadeEmissiveChance: 0,
            facadeAOIntensity: 0,
            floodLightIntensity: 0,
            floodLightColor: [0, 0, 0]
        });

    } else if (painter.renderPass === 'translucent' && drawLayer) {
        let definesForPass: Array<DynamicDefinesType> = [
            "HAS_ATTRIBUTE_a_part_color_emissive",
            "LIGHTING_3D_MODE"
        ];

        if (receiveShadowsEnabled) {
            definesForPass = definesForPass.concat("RENDER_SHADOWS");
        }

        if (painter.shadowRenderer && painter.shadowRenderer.useNormalOffset) {
            definesForPass = definesForPass.concat("NORMAL_OFFSET");
        }

        Debug.run(() => {
            if (painter._debugParams.buildingsShowNormals) {
                definesForPass = definesForPass.concat("DEBUG_SHOW_NORMALS");
            }
        });

        const facadeEmissiveChance = layer.paint.get('building-facade-emissive-chance');
        const facadeAOIntensity = layer.paint.get('building-ambient-occlusion-intensity');

        const floodLightIntensity = layer.paint.get('building-flood-light-intensity');
        const ignoreLut = layer.paint.get('building-flood-light-color-use-theme').constantOr('default') === "none";
        const floodLightColor = layer.paint.get('building-flood-light-color').toNonPremultipliedRenderColor(ignoreLut ? null : layer.lut).toArray01().slice(0, 3) as [number, number, number];
        const floodLightGroundAttenuation = layer.paint.get('building-flood-light-ground-attenuation');
        const floodLightEnabled = floodLightIntensity > 0;

        const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
        if (opacity < 1.0) {
            // Draw transparent buildings in two passes so that only the closest surface is drawn.
            // Insert a draw call to draw all the buildings into only the depth buffer. No colors are drawn.
            drawTiles({
                painter,
                source,
                layer,
                coords,
                defines: definesForPass,
                blendMode: ColorMode.disabled,
                depthMode,
                opacity,
                verticalScale,
                facadeEmissiveChance,
                facadeAOIntensity,
                floodLightIntensity,
                floodLightColor,
                depthOnly: true
            });
        }

        const blendMode = painter.colorModeForRenderPass();
        drawTiles({
            painter,
            source,
            layer,
            coords,
            defines: definesForPass,
            blendMode,
            depthMode,
            opacity,
            verticalScale,
            facadeEmissiveChance,
            facadeAOIntensity,
            floodLightIntensity,
            floodLightColor
        });

        const geFrontCutoffArray = layer.paint.get('building-front-cutoff');
        const geFrontCutoffParams = computeFrontCutoffParams(painter.transform.pitch, geFrontCutoffArray, !!painter.terrain);

        if (aoEnabled) {
            drawGroundEffect(painter, source, layer, coords, true, opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, aoGroundAttenuation, conflateLayer, false, geFrontCutoffParams);
        }
        if (floodLightEnabled) {
            drawGroundEffect(painter, source, layer, coords, false, opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, floodLightGroundAttenuation, conflateLayer, false, geFrontCutoffParams);
        }
    } else if (painter.renderPass === 'light-beam' && drawLayer) {
        const definesForPass: Array<DynamicDefinesType> = [
            "HAS_ATTRIBUTE_a_part_color_emissive",
            "HAS_ATTRIBUTE_a_bloom_attenuation"
        ];

        const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);
        const blendMode = ColorMode.alphaBlended;

        drawTiles({
            painter,
            source,
            layer,
            coords,
            defines: definesForPass,
            blendMode,
            depthMode,
            opacity,
            verticalScale,
            facadeEmissiveChance: 0,
            facadeAOIntensity: 0,
            floodLightIntensity: 0,
            floodLightColor: [0, 0, 0]
        });
    }

    if (painter.shadowRenderer) painter.shadowRenderer.useNormalOffset = false;
    painter.resetStencilClippingMasks();

    PerformanceUtils.measureWithDetails(PerformanceUtils.GROUP_RENDERING, `Building.draw(${painter.renderPass})`, "Building", perfStartTime);

}
