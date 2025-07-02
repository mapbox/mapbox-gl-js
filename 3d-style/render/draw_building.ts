import {buildingBloomUniformValues, buildingDepthUniformValues, buildingUniformValues} from '../render/program/building_program';
import CullFaceMode from '../../src/gl/cull_face_mode';
import DepthMode from '../../src/gl/depth_mode';
import {mat4} from 'gl-matrix';
import StencilMode from '../../src/gl/stencil_mode';
import {getMetersPerPixelAtLatitude} from '../../src/geo/mercator_coordinate';
import {Debug} from '../../src/util/debug';
import {drawGroundEffect as fillExtrusionDrawGroundEffect, GroundEffectProperties, frustumCullShadowCaster} from '../../src/render/draw_fill_extrusion';
import Color from '../../src/style-spec/util/color';
import ColorMode from '../../src/gl/color_mode';
import {PerformanceUtils} from '../../src/util/performance';

import type BuildingBucket from '../data/bucket/building_bucket';
import type {OverscaledTileID} from '../../src/source/tile_id';
import type Painter from '../../src/render/painter';
import type BuildingStyleLayer from '../style/style_layer/building_style_layer';
import type SourceCache from '../../src/source/source_cache';
import type {DynamicDefinesType} from '../../src/render/program/program_uniforms';

export default draw;

interface DrawParams {
    painter: Painter;
    source: SourceCache;
    layer: BuildingStyleLayer;
    coords: Array<OverscaledTileID>;
    defines: Array<DynamicDefinesType>;
    blendMode: Readonly<ColorMode>;
    depthMode: Readonly<DepthMode>;
    verticalScale: number;
}

function drawTiles(params: DrawParams) {
    const {painter, source, layer, coords} = params;
    const defines = params.defines;
    const context = painter.context;

    const isShadowPass = painter.renderPass === 'shadow';
    const isBloomPass = painter.renderPass === 'light-beam';
    const shadowRenderer = painter.shadowRenderer;
    let singleCascadeDefines;

    if (shadowRenderer) {
        singleCascadeDefines = defines.concat(['SHADOWS_SINGLE_CASCADE']);
    }

    const metersPerPixel = getMetersPerPixelAtLatitude(painter.transform.center.lat, painter.transform.zoom);

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer) as BuildingBucket;
        if (!bucket) {
            continue;
        }

        let singleCascade = false;
        if (shadowRenderer) {
            singleCascade = shadowRenderer.getMaxCascadeForTile(coord.toUnwrapped()) === 0;
        }

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        let program;

        let matrix = painter.translatePosMatrix(
            coord.expandedProjMatrix,
            tile,
            [0, 0],
            'map');

        matrix = mat4.scale(mat4.create(), matrix, [1.0, 1.0, params.verticalScale]);

        let uniformValues;

        if (isShadowPass && shadowRenderer) {
            const bucketMaxHeight = bucket.maxHeight * metersPerPixel;
            if (frustumCullShadowCaster(tile.tileID, bucketMaxHeight, painter)) {
                continue;
            }
            let tileShadowPassMatrix = shadowRenderer.calculateShadowPassMatrixFromTile(tile.tileID.toUnwrapped());
            tileShadowPassMatrix = mat4.scale(mat4.create(), tileShadowPassMatrix, [1.0, 1.0, params.verticalScale]);

            uniformValues = buildingDepthUniformValues(tileShadowPassMatrix);

            program = painter.getOrCreateProgram('buildingDepth',
                {config: programConfiguration, defines: singleCascade ? singleCascadeDefines : defines, overrideFog: false});
        } else if (!isBloomPass) {

            const tileMatrix = painter.transform.calculatePosMatrix(coord.toUnwrapped(), painter.transform.worldSize);
            mat4.scale(tileMatrix, tileMatrix, [1, 1, params.verticalScale]);

            const normalMatrix = mat4.create();
            // For tilespace XY, normals are ZUp. Flip Y to follow tile coordinate system orientation.
            // Take vertical scale into account and convert Z to meters.
            mat4.scale(normalMatrix, tileMatrix, [1, -1, 1.0 / metersPerPixel]);
            mat4.invert(normalMatrix, normalMatrix);
            mat4.transpose(normalMatrix, normalMatrix);

            uniformValues = buildingUniformValues(matrix, normalMatrix);

            program =  painter.getOrCreateProgram('building',
                {config: programConfiguration, defines: singleCascade ? singleCascadeDefines : defines, overrideFog: false});

            if (shadowRenderer) {
                shadowRenderer.setupShadowsFromMatrix(tileMatrix, program, true);
            }
        } else {
            program =  painter.getOrCreateProgram('buildingBloom',
            {config: programConfiguration, defines: singleCascade ? singleCascadeDefines : defines, overrideFog: false});

            uniformValues = buildingBloomUniformValues(matrix);
        }

        painter.uploadCommonUniforms(context, program, coord.toUnwrapped(), null, null);

        if (!isBloomPass) {
            const segments = bucket.segments;
            const dynamicBuffers = [bucket.layoutNormalBuffer, bucket.layoutColorBuffer];
            const stencilMode = StencilMode.disabled;
            program.draw(painter, context.gl.TRIANGLES, params.depthMode, stencilMode, params.blendMode, isShadowPass ? CullFaceMode.disabled : CullFaceMode.backCW,
                uniformValues, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
                segments, layer.paint, painter.transform.zoom,
                programConfiguration, dynamicBuffers);
        } else {
            const bloomGeometry = bucket.bloomGeometry;
            const dynamicBuffers = [bloomGeometry.layoutAttenuationBuffer, bloomGeometry.layoutColorBuffer];
            program.draw(painter, context.gl.TRIANGLES, params.depthMode, StencilMode.disabled, params.blendMode, CullFaceMode.disabled,
                uniformValues, layer.id, bloomGeometry.layoutVertexBuffer, bloomGeometry.indexBuffer,
                bloomGeometry.segmentsBucket, layer.paint, painter.transform.zoom,
                programConfiguration, dynamicBuffers);
        }
    }
}

// Debug settings for rendering of buildings

let drawBuildingsDebugParams: DrawBuildingsDebugParams | null = null;

class DrawBuildingsDebugParams {
    public showNormals: boolean = false;
    public drawGroundAO: boolean = true;
    public drawShadowPass: boolean = true;
    public drawTranslucentPass: boolean = true;

    public static getOrCreateInstance(painter: Painter): DrawBuildingsDebugParams {

        if (!drawBuildingsDebugParams) {
            drawBuildingsDebugParams = new DrawBuildingsDebugParams(painter);
        }
        return drawBuildingsDebugParams;
    }

    constructor(painter: Painter) {
        painter.tp.registerParameter(this, ["Buildings"], "drawTranslucentPass", {label: "Draw Translucent Pass"}, () => {
            painter.style.map.triggerRepaint();
        });
        painter.tp.registerParameter(this, ["Buildings"], "drawShadowPass", {label: "Draw Shadow Pass"}, () => {
            painter.style.map.triggerRepaint();
        });
        painter.tp.registerParameter(this, ["Buildings"], "showNormals", {label: "Show normals"}, () => {
            painter.style.map.triggerRepaint();
        });
        painter.tp.registerParameter(this, ["Buildings"], "drawGroundAO", {label: "Ground AO"}, () => {
            painter.style.map.triggerRepaint();
        });
    }
}

function drawGroundEffect(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, coords: Array<OverscaledTileID>, aoPass: boolean, opacity: number, aoIntensity: number, aoRadius: number, floodLightIntensity: number, floodLightColor: [number, number, number], attenuationFactor: number, replacementActive: boolean, renderNeighbors: boolean) {
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

        fillExtrusionDrawGroundEffect(groundEffectProps, painter, source, layer, coords, depthMode, stencilSdfPass, colorSdfPass, CullFaceMode.disabled, aoPass, 'sdf', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, false);
    }

    {
        // Draw the effects.
        const stencilColorPass = showOverdraw ? StencilMode.disabled : new StencilMode({func: gl.EQUAL, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.DECR, gl.DECR);
        const colorColorPass = showOverdraw ? painter.colorModeForRenderPass() : new ColorMode([gl.ONE_MINUS_DST_ALPHA, gl.DST_ALPHA, gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

        fillExtrusionDrawGroundEffect(groundEffectProps, painter, source, layer, coords, depthMode, stencilColorPass, colorColorPass, CullFaceMode.disabled, aoPass, 'color', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, false);
    }
}

function evaluateBucket(painter: Painter, source: SourceCache, layer: BuildingStyleLayer, coords: Array<OverscaledTileID>) {
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket = tile.getBucket(layer) as BuildingBucket | null | undefined;
        if (!bucket) {
            continue;
        }
        if (bucket.needsEvaluation(painter, layer)) {
            bucket.evaluate(layer);
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
    const m = PerformanceUtils.beginMeasure(`Building:draw[${painter.renderPass}]`);

    if (painter.currentLayer < painter.firstLightBeamLayer) {
        painter.firstLightBeamLayer = painter.currentLayer;
    }

    const aoIntensity = layer.paint.get('building-ambient-occlusion-ground-intensity');
    const aoRadius = layer.paint.get('building-ambient-occlusion-ground-radius');
    const aoGroundAttenuation = layer.paint.get('building-ambient-occlusion-ground-attenuation');
    let aoEnabled = aoIntensity > 0 && aoRadius > 0;
    let castsShadowsEnabled = true;
    let receiveShadowsEnabled = true;

    let drawLayer = true;

    const verticalScale = layer.paint.get('building-vertical-scale');

    Debug.run(() => {
        const debugParams = DrawBuildingsDebugParams.getOrCreateInstance(painter);
        aoEnabled = aoEnabled && debugParams.drawGroundAO;
        castsShadowsEnabled = castsShadowsEnabled && debugParams.drawShadowPass;
        drawLayer = drawLayer && debugParams.drawTranslucentPass;
    });

    // Hide shadows if the vertical scale is less than 1.0 (similar to gl-native)
    if (verticalScale < 1.0) {
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
        const colorMode = shadowRenderer.getShadowPassColorMode();

        drawTiles({
            painter,
            source,
            layer,
            coords,
            defines: definesForPass,
            blendMode: colorMode,
            depthMode,
            verticalScale
        });

    } else if (painter.renderPass === 'translucent' && drawLayer) {
        if (aoEnabled) {
            drawGroundEffect(painter, source, layer, coords, true, 1.0, aoIntensity, aoRadius, 0, [0, 0, 0], aoGroundAttenuation, conflateLayer, false);
        }

        let definesForPass: Array<DynamicDefinesType> = [
            "HAS_ATTRIBUTE_a_part_color_emissive",
            "LIGHTING_3D_MODE"
        ];

        if (receiveShadowsEnabled) {
            definesForPass = definesForPass.concat("RENDER_SHADOWS", "DEPTH_TEXTURE");
        }

        if (painter.shadowRenderer.useNormalOffset) {
            definesForPass = definesForPass.concat("NORMAL_OFFSET");
        }
        // Apply debug settinggs. Stripped out in production.
        Debug.run(() => {
            const debugParams = DrawBuildingsDebugParams.getOrCreateInstance(painter);
            if (debugParams.showNormals) {
                definesForPass = definesForPass.concat("DEBUG_SHOW_NORMALS");
            }
        });

        const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
        const blendMode = painter.colorModeForRenderPass();

        drawTiles({
            painter,
            source,
            layer,
            coords,
            defines: definesForPass,
            blendMode,
            depthMode,
            verticalScale
        });
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
            verticalScale
        });
    }

    if (painter.shadowRenderer) painter.shadowRenderer.useNormalOffset = false;
    painter.resetStencilClippingMasks();

    PerformanceUtils.endMeasure(m);
}
