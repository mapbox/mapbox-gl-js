import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import EXTENT from '../style-spec/data/extent';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import FillExtrusionBucket, {
    fillExtrusionHeightLift,
    ELEVATION_SCALE,
    ELEVATION_OFFSET,
    HIDDEN_BY_REPLACEMENT,
} from '../data/bucket/fill_extrusion_bucket';
import {
    fillExtrusionUniformValues,
    fillExtrusionDepthUniformValues,
    fillExtrusionPatternUniformValues,
    fillExtrusionGroundEffectUniformValues
} from './program/fill_extrusion_program';
import Point from '@mapbox/point-geometry';
import {neighborCoord} from '../source/tile_id';
import assert from 'assert';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';
import {globeToMercatorTransition} from '../geo/projection/globe_util';
import Color from '../style-spec/util/color';
import {calculateGroundShadowFactor} from '../../3d-style/render/shadow_renderer';
import {RGBAImage} from '../util/image';
import Texture from './texture';
import {Frustum} from '../util/primitives';
import {mat4} from "gl-matrix";
import {getCutoffParams} from './cutoff';
import {ZoomDependentExpression} from '../style-spec/expression/index';
import browser from '../util/browser';

import type {vec3} from 'gl-matrix';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type SourceCache from '../source/source_cache';
import type Painter from './painter';
import type Tile from '../source/tile';
import type {Terrain} from '../terrain/terrain';
import type Context from '../gl/context';
import type {OverscaledTileID} from '../source/tile_id';
import type {
    GroundEffect,
    PartData
} from '../data/bucket/fill_extrusion_bucket';

export default draw;

type GroundEffectSubpassType = 'clear' | 'sdf' | 'color';

function draw(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>) {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const context = painter.context;
    const gl = context.gl;
    const terrain = painter.terrain;
    const rtt = terrain && terrain.renderingToTexture;
    if (opacity === 0) {
        return;
    }

    // Update replacement used with model layer conflation
    const conflateLayer = painter.conflationActive && painter.style.isLayerClipped(layer, source.getSource());
    const layerIdx = painter.style.order.indexOf(layer.fqid);
    if (conflateLayer) {
        updateReplacement(painter, source, layer, coords, layerIdx);
    }

    if (terrain || conflateLayer) {
        for (const coord of coords) {
            const tile = source.getTile(coord);
            const bucket: FillExtrusionBucket | null | undefined = (tile.getBucket(layer) as any);
            if (!bucket) {
                continue;
            }

            updateBorders(painter.context, source, coord, bucket, layer, terrain, conflateLayer);
        }
    }

    if (painter.renderPass === 'shadow' && painter.shadowRenderer) {
        const shadowRenderer = painter.shadowRenderer;
        if (terrain) {
            const noShadowCutoff = 0.65;

            if (opacity < noShadowCutoff) {
                const expression = layer._transitionablePaint._values['fill-extrusion-opacity'].value.expression;
                if (expression instanceof ZoomDependentExpression) {
                    // avoid rendering shadows during fade in / fade out on terrain
                    return;
                }
            }
        }
        const depthMode = shadowRenderer.getShadowPassDepthMode();
        const colorMode = shadowRenderer.getShadowPassColorMode();

        drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, colorMode, conflateLayer);
    } else if (painter.renderPass === 'translucent') {

        const noPattern = !layer.paint.get('fill-extrusion-pattern').constantOr((1 as any));

        const color = layer.paint.get('fill-extrusion-color').constantOr(Color.white);

        if (!rtt && color.a !== 0.0) {
            const depthMode = new DepthMode(painter.context.gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

            if (opacity === 1 && noPattern) {
                drawExtrusionTiles(painter, source, layer, coords, depthMode, StencilMode.disabled, ColorMode.unblended, conflateLayer);
            } else {
                // Draw transparent buildings in two passes so that only the closest surface is drawn.
                // First draw all the extrusions into only the depth buffer. No colors are drawn.
                drawExtrusionTiles(painter, source, layer, coords, depthMode,
                    StencilMode.disabled,
                    ColorMode.disabled,
                    conflateLayer);

                // Then draw all the extrusions a second type, only coloring fragments if they have the
                // same depth value as the closest fragment in the previous pass. Use the stencil buffer
                // to prevent the second draw in cases where we have coincident polygons.
                drawExtrusionTiles(painter, source, layer, coords, depthMode,
                    painter.stencilModeFor3D(),
                    painter.colorModeForRenderPass(),
                    conflateLayer);

                painter.resetStencilClippingMasks();
            }
        }

        // Note that when rendering ground effects in immediate mode the implementation below assumes that the alpha channel of the main framebuffer is unused and set to 1.
        // In draped mode this assumption no longer holds (since layer emissiveness is also encoded in the alpha channel) and therefore few more steps are required to implement the ground flood light and AO correctly.
        const lighting3DMode = painter.style.enable3dLights();
        const noTerrain = !terrain;
        const noGlobe = painter.transform.projection.name !== 'globe';
        const immediateMode = noTerrain && noGlobe;

        if (lighting3DMode && noPattern && (immediateMode || rtt)) {
            assert(immediateMode ? !rtt : !!rtt);

            const opacity = layer.paint.get('fill-extrusion-opacity');
            const aoIntensity = layer.paint.get('fill-extrusion-ambient-occlusion-intensity');
            const aoRadius = layer.paint.get('fill-extrusion-ambient-occlusion-ground-radius');
            const floodLightIntensity = layer.paint.get('fill-extrusion-flood-light-intensity');

            const floodLightIgnoreLut = layer.paint.get('fill-extrusion-flood-light-color-use-theme').constantOr("default") === 'none';

            const floodLightColor = layer.paint.get('fill-extrusion-flood-light-color').toRenderColor(floodLightIgnoreLut ? null : layer.lut).toArray01().slice(0, 3);

            const aoEnabled = aoIntensity > 0 && aoRadius > 0;

            const floodLightEnabled = floodLightIntensity > 0;

            const lerp = (a: number, b: number, t: number) => { return (1 - t) * a + t * b; };

            const passImmediate = (aoPass: boolean) => {
                const depthMode = painter.depthModeForSublayer(1, DepthMode.ReadOnly, gl.LEQUAL, true);
                const t = aoPass ? layer.paint.get('fill-extrusion-ambient-occlusion-ground-attenuation') : layer.paint.get('fill-extrusion-flood-light-ground-attenuation');

                const attenuation = lerp(0.1, 3, t);
                const showOverdraw = painter._showOverdrawInspector;

                if (!showOverdraw) {
                    // Mark the alpha channel with the DF values (that determine the intensity of the effects). No color is written.
                    const stencilSdfPass = new StencilMode({func: gl.ALWAYS, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
                    const colorSdfPass = new ColorMode([gl.ONE, gl.ONE, gl.ONE, gl.ONE], Color.transparent, [false, false, false, true], gl.MIN);

                    drawGroundEffect(painter, source, layer, coords, depthMode, stencilSdfPass, colorSdfPass, CullFaceMode.disabled, aoPass, 'sdf', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, false);
                }

                {
                    // Draw the effects.
                    const stencilColorPass = showOverdraw ? StencilMode.disabled : new StencilMode({func: gl.EQUAL, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.DECR, gl.DECR);
                    const colorColorPass = showOverdraw ? painter.colorModeForRenderPass() : new ColorMode([gl.ONE_MINUS_DST_ALPHA, gl.DST_ALPHA, gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);

                    drawGroundEffect(painter, source, layer, coords, depthMode, stencilColorPass, colorColorPass, CullFaceMode.disabled, aoPass, 'color', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, false);
                }
            };

            if (rtt) {
                const passDraped = (aoPass: boolean, renderNeighbors: boolean, framebufferCopyTexture?: Texture) => {
                    assert(framebufferCopyTexture);

                    const depthMode = painter.depthModeForSublayer(1, DepthMode.ReadOnly, gl.LEQUAL, false);
                    const t = aoPass ? layer.paint.get('fill-extrusion-ambient-occlusion-ground-attenuation') : layer.paint.get('fill-extrusion-flood-light-ground-attenuation');

                    const attenuation = lerp(0.1, 3, t);

                    {
                        // Clear framebuffer's alpha channel to 1 since we're using gl.MIN blend operation in the subsequent steps.
                        const colorMode = new ColorMode([gl.ONE, gl.ONE, gl.ONE, gl.ONE], Color.transparent, [false, false, false, true]);

                        drawGroundEffect(painter, source, layer, coords, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled, aoPass, 'clear', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, renderNeighbors);
                    }

                    {
                        // Mark the alpha channel with the DF values (that determine the intensity of the effects). No color is written.
                        const stencilSdfPass = new StencilMode({func: gl.ALWAYS, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
                        const colorSdfPass = new ColorMode([gl.ONE, gl.ONE, gl.ONE, gl.ONE], Color.transparent, [false, false, false, true], gl.MIN);

                        drawGroundEffect(painter, source, layer, coords, depthMode, stencilSdfPass, colorSdfPass, CullFaceMode.disabled, aoPass, 'sdf', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, renderNeighbors);
                    }

                    {
                        // Draw the effects. The inverse of the alpha channel is used so that in the next pass we can correctly incorporate it with the emissive strength values that are also encoded in the alpha channel (now present in the texture).
                        const srcColorFactor = aoPass ? gl.ZERO : gl.ONE_MINUS_DST_ALPHA; // For AO, it's enough to multiply the color with the intensity.
                        const stencilColorPass = new StencilMode({func: gl.EQUAL, mask: 0xFF}, 0xFF, 0xFF, gl.KEEP, gl.DECR, gl.DECR);
                        const colorColorPass = new ColorMode([srcColorFactor, gl.DST_ALPHA, gl.ONE_MINUS_DST_ALPHA, gl.ZERO], Color.transparent, [true, true, true, true]);

                        drawGroundEffect(painter, source, layer, coords, depthMode, stencilColorPass, colorColorPass, CullFaceMode.disabled, aoPass, 'color', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, renderNeighbors);
                    }

                    {
                        // Re-write to the alpha channel of the framebuffer based on existing values (of ground effects) and emissive values (saved to texture in earlier step).
                        // Note that in draped mode an alpha value of 1 indicates fully emissiveness for a fragment and a value of 0 means fully lit (3d lighting).

                        // We don't really need to encode the alpha values for AO as the layers have already been multiplied by its intensity. The gl.FUNC_ADD (as blending equation) and gl.ZERO (as dest alpha factor) would ensure this.
                        const dstAlphaFactor = aoPass ? gl.ZERO : gl.ONE;
                        const blendEquation = aoPass ? gl.FUNC_ADD : gl.MAX;
                        const colorMode = new ColorMode([gl.ONE, gl.ONE, gl.ONE, dstAlphaFactor], Color.transparent, [false, false, false, true], blendEquation);

                        drawGroundEffect(painter, source, layer, coords, depthMode, StencilMode.disabled, colorMode, CullFaceMode.disabled, aoPass, 'clear', opacity, aoIntensity, aoRadius, floodLightIntensity, floodLightColor, attenuation, conflateLayer, renderNeighbors, framebufferCopyTexture);
                    }
                };

                if (aoEnabled || floodLightEnabled) {
                    painter.prepareDrawTile();
                    let framebufferCopyTexture;
                    // Save the alpha channel of the framebuffer used by emissive layers.
                    if (terrain) { // Condition is anywyas guaranteed by rtt variable. Used only to suppress flow errors.
                        const width = terrain.drapeBufferSize[0];
                        const height = terrain.drapeBufferSize[1];
                        framebufferCopyTexture = terrain.framebufferCopyTexture;
                        if (!framebufferCopyTexture || (framebufferCopyTexture && (framebufferCopyTexture.size[0] !== width || framebufferCopyTexture.size[1] !== height))) {
                            if (framebufferCopyTexture) framebufferCopyTexture.destroy();
                            framebufferCopyTexture = terrain.framebufferCopyTexture = new Texture(context,
                                new RGBAImage({width, height}), gl.RGBA8);
                        }
                        framebufferCopyTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
                        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
                    }
                    // Render ground AO.
                    if (aoEnabled) {
                        passDraped(true, false, framebufferCopyTexture);
                    }
                    // Render ground flood light.
                    if (floodLightEnabled) {
                        passDraped(false, true, framebufferCopyTexture);
                    }
                }
            } else { // immediate mode
                // Render ground AO.
                if (aoEnabled) {
                    passImmediate(true);
                }
                // Render ground flood light.
                if (floodLightEnabled) {
                    passImmediate(false);
                }

                if (aoEnabled || floodLightEnabled) {
                    // Reset clipping masks so follow-up rendering code can reliably use the stencil buffer.
                    painter.resetStencilClippingMasks();
                }
            }
        }
    }
}

function drawExtrusionTiles(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>, depthMode: DepthMode, stencilMode: StencilMode, colorMode: ColorMode, replacementActive: boolean) {
    layer.resetLayerRenderingStats(painter);
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const patternProperty = layer.paint.get('fill-extrusion-pattern');

    const image = patternProperty.constantOr((1 as any));
    const opacity = layer.paint.get('fill-extrusion-opacity');
    const lighting3DMode = painter.style.enable3dLights();
    const aoRadius = (lighting3DMode && !image) ? layer.paint.get('fill-extrusion-ambient-occlusion-wall-radius') : layer.paint.get('fill-extrusion-ambient-occlusion-radius');
    const ao: [number, number] = [layer.paint.get('fill-extrusion-ambient-occlusion-intensity'), aoRadius];
    const edgeRadius = layer.layout.get('fill-extrusion-edge-radius');

    const zeroRoofRadius = edgeRadius > 0 && !layer.paint.get('fill-extrusion-rounded-roof');
    const roofEdgeRadius = zeroRoofRadius ? 0.0 : edgeRadius;
    const heightLift = tr.projection.name === 'globe' ? fillExtrusionHeightLift() : 0;
    const isGlobeProjection = tr.projection.name === 'globe';
    const globeToMercator = isGlobeProjection ? globeToMercatorTransition(tr.zoom) : 0.0;
    const mercatorCenter: [number, number] = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];

    const floodLightColorUseTheme = layer.paint.get('fill-extrusion-flood-light-color-use-theme').constantOr('default') === 'none';
    const floodLightColor = (layer.paint.get('fill-extrusion-flood-light-color').toRenderColor(floodLightColorUseTheme ? null : layer.lut).toArray01().slice(0, 3) as any);
    const floodLightIntensity = layer.paint.get('fill-extrusion-flood-light-intensity');
    const verticalScale = layer.paint.get('fill-extrusion-vertical-scale');
    const wallMode = layer.paint.get('fill-extrusion-line-width').constantOr(1.0) !== 0.0;
    const heightAlignment = layer.paint.get('fill-extrusion-height-alignment');
    const baseAlignment = layer.paint.get('fill-extrusion-base-alignment');

    const cutoffParams = getCutoffParams(painter, layer.paint.get('fill-extrusion-cutoff-fade-range'));
    const baseDefines = ([] as any);
    if (isGlobeProjection) {
        baseDefines.push('PROJECTION_GLOBE_VIEW');
    }

    if (ao[0] > 0) { // intensity
        baseDefines.push('FAUX_AO');
    }
    if (zeroRoofRadius) {
        baseDefines.push('ZERO_ROOF_RADIUS');
    }
    if (replacementActive) {
        baseDefines.push('HAS_CENTROID');
    }

    if (floodLightIntensity > 0) {
        baseDefines.push('FLOOD_LIGHT');
    }
    if (cutoffParams.shouldRenderCutoff) {
        baseDefines.push('RENDER_CUTOFF');
    }
    if (wallMode) {
        baseDefines.push('RENDER_WALL_MODE');
    }

    let singleCascadeDefines;

    const isShadowPass = painter.renderPass === 'shadow';
    const shadowRenderer = painter.shadowRenderer;
    const drawDepth = isShadowPass && !!shadowRenderer;
    if (painter.shadowRenderer) painter.shadowRenderer.useNormalOffset = true;

    let groundShadowFactor: [number, number, number] = [0, 0, 0];
    if (shadowRenderer) {
        const directionalLight = painter.style.directionalLight;
        const ambientLight = painter.style.ambientLight;
        if (directionalLight && ambientLight) {
            groundShadowFactor = calculateGroundShadowFactor(painter.style, directionalLight, ambientLight);
        }

        if (!isShadowPass) {
            baseDefines.push('RENDER_SHADOWS', 'DEPTH_TEXTURE');
            if (shadowRenderer.useNormalOffset) {
                baseDefines.push('NORMAL_OFFSET');
            }
        }
        singleCascadeDefines = baseDefines.concat(['SHADOWS_SINGLE_CASCADE']);
    }

    const programName = drawDepth ? 'fillExtrusionDepth' : (image ? 'fillExtrusionPattern' : 'fillExtrusion');
    const stats = layer.getLayerRenderingStats();
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: FillExtrusionBucket | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket || bucket.projection.name !== tr.projection.name) continue;

        let singleCascade = false;
        if (shadowRenderer) {
            singleCascade = shadowRenderer.getMaxCascadeForTile(coord.toUnwrapped()) === 0;
        }

        const affectedByFog = painter.isTileAffectedByFog(coord);
        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.getOrCreateProgram(programName,
            {config: programConfiguration, defines: singleCascade ? singleCascadeDefines : baseDefines, overrideFog: affectedByFog});

        if (painter.terrain) {
            const terrain = painter.terrain;
            terrain.setupElevationDraw(tile, program, {useMeterToDem: true});
        }

        if (!bucket.centroidVertexBuffer) {
            const attrIndex: number | undefined = program.attributes['a_centroid_pos'];
            if (attrIndex !== undefined) gl.vertexAttrib2f(attrIndex, 0, 0);
        }

        if (!isShadowPass && shadowRenderer) {
            shadowRenderer.setupShadows(tile.tileID.toUnwrapped(), program, 'vector-tile', tile.tileID.overscaledZ);
        }

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            if (tile.imageAtlasTexture) {
                tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            }
            programConfiguration.updatePaintBuffers();
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const patternImage = ResolvedImage.from(constantPattern).getPrimary().scaleSelf(browser.devicePixelRatio);
            const posTo = atlas.patternPositions.get(patternImage.toString());
            if (posTo) programConfiguration.setConstantPatternPositions(posTo);
        }

        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const lineWidthScale = 1.0 / bucket.tileToMeter;
        let uniformValues;
        if (isShadowPass && shadowRenderer) {
            if (frustumCullShadowCaster(tile.tileID, bucket, painter)) {
                continue;
            }
            const tileMatrix = shadowRenderer.calculateShadowPassMatrixFromTile(tile.tileID.toUnwrapped());

            uniformValues = fillExtrusionDepthUniformValues(tileMatrix, roofEdgeRadius, lineWidthScale, verticalScale, heightAlignment, baseAlignment);
        } else {
            const matrix = painter.translatePosMatrix(
                coord.expandedProjMatrix,
                tile,

                layer.paint.get('fill-extrusion-translate'),
                layer.paint.get('fill-extrusion-translate-anchor'));

            const invMatrix = tr.projection.createInversionMatrix(tr, coord.canonical);
            if (image) {
                uniformValues = fillExtrusionPatternUniformValues(matrix, painter, shouldUseVerticalGradient, opacity, ao, roofEdgeRadius, lineWidthScale, coord,
                    tile, heightLift, heightAlignment, baseAlignment, globeToMercator, mercatorCenter, invMatrix, floodLightColor, verticalScale);
            } else {
                uniformValues = fillExtrusionUniformValues(matrix, painter, shouldUseVerticalGradient, opacity, ao, roofEdgeRadius, lineWidthScale, coord,
                    heightLift, heightAlignment, baseAlignment, globeToMercator, mercatorCenter, invMatrix, floodLightColor, verticalScale, floodLightIntensity, groundShadowFactor);
            }
        }

        painter.uploadCommonUniforms(context, program, coord.toUnwrapped(), null, cutoffParams);

        assert(!isGlobeProjection || bucket.layoutVertexExtBuffer);

        let segments = bucket.segments;
        if (tr.projection.name === 'mercator' && !isShadowPass) {
            segments = bucket.getVisibleSegments(tile.tileID, painter.terrain, painter.transform.getFrustum(0));
            if (!segments.get().length) {
                continue;
            }
        }
        if (stats) {
            if (!isShadowPass) {
                for (const segment of segments.get()) {
                    stats.numRenderedVerticesInTransparentPass += segment.primitiveLength;
                }
            } else {
                for (const segment of segments.get()) {
                    stats.numRenderedVerticesInShadowPass += segment.primitiveLength;
                }
            }
        }
        const dynamicBuffers = [];
        if (painter.terrain || replacementActive) dynamicBuffers.push(bucket.centroidVertexBuffer);
        if (isGlobeProjection) dynamicBuffers.push(bucket.layoutVertexExtBuffer);
        if (wallMode) dynamicBuffers.push(bucket.wallVertexBuffer);

        program.draw(painter, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            segments, layer.paint, painter.transform.zoom,
            programConfiguration, dynamicBuffers);
    }

    if (painter.shadowRenderer) painter.shadowRenderer.useNormalOffset = false;
}

function updateReplacement(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>, layerIndex: number) {
    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: FillExtrusionBucket | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket) {
            continue;
        }
        bucket.updateReplacement(coord, painter.replacementSource, layerIndex);
        bucket.uploadCentroid(painter.context);
    }
}

function drawGroundEffect(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>, depthMode: DepthMode, stencilMode: StencilMode, colorMode: ColorMode, cullFaceMode: CullFaceMode, aoPass: boolean, subpass: GroundEffectSubpassType, opacity: number, aoIntensity: number, aoRadius: number, floodLightIntensity: number, floodLightColor: any, attenuation: number, replacementActive: boolean, renderNeighbors: boolean, framebufferCopyTexture?: Texture | null) {
    const context = painter.context;
    const gl = context.gl;
    const tr = painter.transform;
    const zoom = painter.transform.zoom;
    const defines = ([] as any);

    const cutoffParams = getCutoffParams(painter, layer.paint.get('fill-extrusion-cutoff-fade-range'));
    if (subpass === 'clear') {
        defines.push('CLEAR_SUBPASS');
        if (framebufferCopyTexture) {
            defines.push('CLEAR_FROM_TEXTURE');
            context.activeTexture.set(gl.TEXTURE0);
            framebufferCopyTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
    } else if (subpass === 'sdf') {
        defines.push('SDF_SUBPASS');
    }
    if (replacementActive) {
        defines.push('HAS_CENTROID');
    }
    if (cutoffParams.shouldRenderCutoff) {
        defines.push('RENDER_CUTOFF');
    }
    const edgeRadius = layer.layout.get('fill-extrusion-edge-radius');

    const renderGroundEffectTile = (coord: OverscaledTileID, groundEffect: GroundEffect, segments: any, matrix: mat4, meterToTile: number) => {
        const programConfiguration = groundEffect.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);
        const program = painter.getOrCreateProgram('fillExtrusionGroundEffect', {config: programConfiguration, defines, overrideFog: affectedByFog});

        const ao: [number, number] = [aoIntensity, aoRadius * meterToTile];

        const edgeRadiusTile = zoom >= 17 ? 0 : edgeRadius * meterToTile;
        const fbSize = framebufferCopyTexture ? framebufferCopyTexture.size[0] : 0;
        const uniformValues = fillExtrusionGroundEffectUniformValues(painter, matrix, opacity, aoPass, meterToTile, ao, floodLightIntensity, floodLightColor, attenuation, edgeRadiusTile, fbSize);

        const dynamicBuffers = [];
        if (replacementActive) dynamicBuffers.push(groundEffect.hiddenByLandmarkVertexBuffer);

        painter.uploadCommonUniforms(context, program, coord.toUnwrapped(), null, cutoffParams);

        program.draw(painter, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, cullFaceMode,
            uniformValues, layer.id, groundEffect.vertexBuffer, groundEffect.indexBuffer,
            segments, layer.paint, zoom,
            programConfiguration, dynamicBuffers);
    };

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: FillExtrusionBucket | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket || bucket.projection.name !== tr.projection.name || !bucket.groundEffect || (bucket.groundEffect && !bucket.groundEffect.hasData())) continue;

        const groundEffect: GroundEffect = (bucket.groundEffect as any);
        const meterToTile = 1 / bucket.tileToMeter;
        {
            const matrix = painter.translatePosMatrix(
                coord.projMatrix,
                tile,

                layer.paint.get('fill-extrusion-translate'),
                layer.paint.get('fill-extrusion-translate-anchor'));

            const segments = groundEffect.getDefaultSegment();
            renderGroundEffectTile(coord, groundEffect, segments, matrix, meterToTile);
        }

        if (renderNeighbors) {
            for (let i = 0; i < 4; i++) {
                const nCoord = neighborCoord[i](coord);
                const nTile = source.getTile(nCoord);
                if (!nTile) continue;

                const nBucket: FillExtrusionBucket | null | undefined = (nTile.getBucket(layer) as any);
                if (!nBucket || nBucket.projection.name !== tr.projection.name || !nBucket.groundEffect || (nBucket.groundEffect && !nBucket.groundEffect.hasData())) continue;

                const nGroundEffect: GroundEffect = (nBucket.groundEffect as any);
                assert(nGroundEffect.regionSegments);

                let translation, regionId;
                if (i === 0) { // left
                    translation = [-EXTENT, 0, 0];
                    regionId = 1;
                } else if (i === 1) { // right
                    translation = [EXTENT, 0, 0];
                    regionId = 0;
                } else if (i === 2) { // top
                    translation = [0, -EXTENT, 0];
                    regionId = 3;
                } else { // bottom
                    translation = [0, EXTENT, 0];
                    regionId = 2;
                }

                const segments = nGroundEffect.regionSegments[regionId];
                // No geometry from the neighbour tile intersects the current tile.
                if (!segments) continue;

                const proj = new Float32Array(16);
                mat4.translate(proj, coord.projMatrix, translation);
                const matrix = painter.translatePosMatrix(
                    proj,
                    tile,

                    layer.paint.get('fill-extrusion-translate'),
                    layer.paint.get('fill-extrusion-translate-anchor'));
                renderGroundEffectTile(coord, nGroundEffect, segments, matrix, meterToTile);
            }
        }
    }
}

// Flat roofs array is prepared in the bucket, except for buildings that are on tile borders.
// For them, join pieces, calculate joined size here, and then upload data.
function updateBorders(context: Context, source: SourceCache, coord: OverscaledTileID, bucket: FillExtrusionBucket, layer: FillExtrusionStyleLayer, terrain: Terrain | null | undefined, reconcileReplacementState: boolean) {
    if (bucket.centroidVertexArray.length === 0) {
        bucket.createCentroidsBuffer();
    }

    const demTile = terrain ? terrain.findDEMTileFor(coord) : null;
    if ((!demTile || !demTile.dem) && !reconcileReplacementState) {
        return;     // defer update until an elevation tile is available.
    }
    // invalidate border computation if DEM tile has updated since last border update
    if (terrain && demTile && demTile.dem) {
        if (bucket.selfDEMTileTimestamp !== demTile.dem._timestamp) {
            bucket.borderDoneWithNeighborZ = [-1, -1, -1, -1];
            bucket.selfDEMTileTimestamp = demTile.dem._timestamp;
        }
    }

    const reconcileReplacement = (centroid1: PartData, centroid2: PartData) => {
        const hiddenFlag = (centroid1.flags | centroid2.flags) & HIDDEN_BY_REPLACEMENT;
        if (hiddenFlag) {
            centroid1.flags |= HIDDEN_BY_REPLACEMENT;
            centroid2.flags |= HIDDEN_BY_REPLACEMENT;
        } else {
            centroid1.flags &= ~HIDDEN_BY_REPLACEMENT;
            centroid2.flags &= ~HIDDEN_BY_REPLACEMENT;
        }
    };

    const encodeHeightAsCentroid = (height: number) => {
        return new Point(Math.ceil((height + ELEVATION_OFFSET) * ELEVATION_SCALE), 0);
    };

    const getLoadedBucket = (nid: OverscaledTileID) => {
        const minzoom = source.getSource().minzoom;
        const getBucket = (key: number) => {
            const n = source.getTileByID(key);
            if (n && n.hasData()) {
                return n.getBucket(layer);
            }
        };
        // Look one tile zoom above and under. We do this to avoid flickering and
        // use the content in Z-1 and Z+1 buckets until Z bucket is loaded or handle
        // behavior on borders between different zooms.
        const zoomLevels = [0, -1, 1];
        for (const i of zoomLevels) {
            const z = nid.overscaledZ + i;
            if (z < minzoom) continue;
            const key = nid.calculateScaledKey(nid.overscaledZ + i);
            const b = getBucket(key);
            if (b) {
                return b;
            }
        }
    };

    const projectedToBorder = [0, 0, 0]; // [min, max, maxOffsetFromBorder]
    const xjoin = (a: PartData, b: PartData) => {
        projectedToBorder[0] = Math.min(a.min.y, b.min.y);
        projectedToBorder[1] = Math.max(a.max.y, b.max.y);
        projectedToBorder[2] = EXTENT - b.min.x > a.max.x ? b.min.x - EXTENT : a.max.x;
        return projectedToBorder;
    };
    const yjoin = (a: PartData, b: PartData) => {
        projectedToBorder[0] = Math.min(a.min.x, b.min.x);
        projectedToBorder[1] = Math.max(a.max.x, b.max.x);
        projectedToBorder[2] = EXTENT - b.min.y > a.max.y ? b.min.y - EXTENT : a.max.y;
        return projectedToBorder;
    };
    const projectCombinedSpanToBorder = [
        (a: PartData, b: PartData) => xjoin(a, b),
        (a: PartData, b: PartData) => xjoin(b, a),
        (a: PartData, b: PartData) => yjoin(a, b),
        (a: PartData, b: PartData) => yjoin(b, a)
    ];

    const error = 3; // Allow intrusion of a building to the building with adjacent wall.

    const flatBase = (min: number, max: number, edge: number, neighborDEMTile: Tile, neighborTileID: OverscaledTileID, verticalEdge: boolean, maxOffsetFromBorder: number) => {
        if (!terrain) {
            return 0;
        }
        const points: vec3[] = [[verticalEdge ? edge : min, verticalEdge ? min : edge, 0], [verticalEdge ? edge : max, verticalEdge ? max : edge, 0]];

        const coord3 = maxOffsetFromBorder < 0 ? EXTENT + maxOffsetFromBorder : maxOffsetFromBorder;
        const thirdPoint: vec3 = [verticalEdge ? coord3 : (min + max) / 2, verticalEdge ? (min + max) / 2 : coord3, 0];
        if ((edge === 0 && maxOffsetFromBorder < 0) || (edge !== 0 && maxOffsetFromBorder > 0)) {
            // Third point is inside neighbor tile, not in the |coord| tile.
            terrain.getForTilePoints(neighborTileID, [thirdPoint], true, neighborDEMTile);
        } else {
            points.push(thirdPoint);
        }
        terrain.getForTilePoints(coord, points, true, demTile);
        return Math.max(points[0][2], points[1][2], thirdPoint[2]) / terrain.exaggeration();
    };

    // Process all four borders: get neighboring tile
    for (let i = 0; i < 4; i++) {
        // sorted by border intersection area minimums, ascending.
        const a = bucket.borderFeatureIndices[i];
        if (a.length === 0) {
            continue;
        }

        // Look up the neighbor tile's bucket
        const nid = neighborCoord[i](coord);
        const nBucket = getLoadedBucket(nid);
        if (!nBucket || !(nBucket instanceof FillExtrusionBucket)) {
            continue;
        }

        // Look up the neighbor DEM tile
        const neighborDEMTile = terrain ? terrain.findDEMTileFor(nid) : null;
        if ((!neighborDEMTile || !neighborDEMTile.dem) && !reconcileReplacementState) {
            continue;
        }

        // invalidate border computation if neighbour DEM tile has updated since last border update
        if (terrain && neighborDEMTile && neighborDEMTile.dem) {
            if (bucket.borderDEMTileTimestamp[i] !== neighborDEMTile.dem._timestamp) {
                bucket.borderDoneWithNeighborZ[i] = -1;
                bucket.borderDEMTileTimestamp[i] = neighborDEMTile.dem._timestamp;
            }
        }

        if (bucket.borderDoneWithNeighborZ[i] === nBucket.canonical.z) {
            continue;
        }

        if (nBucket.centroidVertexArray.length === 0) {
            nBucket.createCentroidsBuffer();
        }

        const j = (i < 2 ? 1 : 5) - i;
        const updateNeighbor = nBucket.borderDoneWithNeighborZ[j] !== bucket.canonical.z;
        const b = nBucket.borderFeatureIndices[j];
        let ib = 0;

        // If neighbors are of different canonical z, we cannot join parts but show
        // all without flat roofs.
        if (bucket.canonical.z !== nBucket.canonical.z) {
            for (const index of a) {
                bucket.showCentroid(bucket.featuresOnBorder[index]);
            }
            if (updateNeighbor) {
                for (const index of b) {
                    nBucket.showCentroid(nBucket.featuresOnBorder[index]);
                }
            }
            bucket.borderDoneWithNeighborZ[i] = nBucket.canonical.z;
            nBucket.borderDoneWithNeighborZ[j] = bucket.canonical.z;
        }

        for (const ia of a) {
            const partA = bucket.featuresOnBorder[ia];
            const centroidA = bucket.centroidData[partA.centroidDataIndex];
            assert(partA.borders);
            const partABorderRange = (partA.borders as any)[i];

            // Find all nBucket parts that share the border overlap
            let partB;
            while (ib < b.length) {
                // Pass all that are before the overlap
                partB = nBucket.featuresOnBorder[b[ib]];
                assert(partB.borders);
                const partBBorderRange = (partB.borders)[j];
                if (partBBorderRange[1] > partABorderRange[0] + error ||
                    partBBorderRange[0] > partABorderRange[0] - error) {
                    break;
                }
                nBucket.showCentroid(partB);
                ib++;
            }

            if (partB && ib < b.length) {
                const saveIb = ib;
                let count = 0;
                while (true) {
                    // Collect all parts overlapping parts on the edge, to make sure it is only one.
                    assert(partB.borders);
                    const partBBorderRange = (partB.borders)[j];
                    if (partBBorderRange[0] > partABorderRange[1] - error) {
                        break;
                    }
                    count++;
                    if (++ib === b.length) {
                        break;
                    }
                    partB = nBucket.featuresOnBorder[b[ib]];
                }
                partB = nBucket.featuresOnBorder[b[saveIb]];
                let doReconcile = false;
                if (count >= 1) {
                    // if it can be concluded that it is the piece of the same feature,
                    // use it, even following features (inner details) overlap on border edge.
                    assert(partB.borders);
                    const partBBorderRange = (partB.borders)[j];
                    if (Math.abs(partABorderRange[0] - partBBorderRange[0]) < error &&
                        Math.abs(partABorderRange[1] - partBBorderRange[1]) < error) {
                        count = 1;
                        // In some cases count could be 1 but a different feature, here we make sure
                        // we are reconciling the same feature
                        doReconcile = true;
                        ib = saveIb + 1;
                    }
                } else if (count === 0) {
                    // No B for A, show it, no flat roofs.
                    bucket.showCentroid(partA);
                    continue;
                }

                const centroidB = nBucket.centroidData[partB.centroidDataIndex];
                if (reconcileReplacementState && doReconcile) {
                    reconcileReplacement(centroidA, centroidB);
                }

                const moreThanOneBorderIntersected = partA.intersectsCount() > 1 || partB.intersectsCount() > 1;
                if (count > 1) {
                    ib = saveIb;    // rewind unprocessed ib so that it is processed again for the next ia.
                    centroidA.centroidXY = centroidB.centroidXY = new Point(0, 0);
                } else if (neighborDEMTile && neighborDEMTile.dem && !moreThanOneBorderIntersected) {
                    // If any of a or b crosses more than one tile edge, don't support flat roof.
                    // Now we have 1-1 matching of parts in both tiles that share the edge. Calculate flat base
                    // elevation as average of three points: 2 are edge points (combined span projected to border) and
                    // one is point of span that has maximum offset to border.
                    const span = projectCombinedSpanToBorder[i](centroidA, centroidB);
                    const edge = (i % 2) ? EXTENT - 1 : 0;

                    const height = flatBase(span[0], Math.min(EXTENT - 1, span[1]), edge, neighborDEMTile, nid, i < 2, span[2]);
                    centroidA.centroidXY = centroidB.centroidXY = encodeHeightAsCentroid(height);
                }  else if (moreThanOneBorderIntersected) {
                    centroidA.centroidXY = centroidB.centroidXY = new Point(0, 0);
                } else {
                    centroidA.centroidXY = bucket.encodeBorderCentroid(partA);
                    centroidB.centroidXY = nBucket.encodeBorderCentroid(partB);
                }

                bucket.writeCentroidToBuffer(centroidA);
                nBucket.writeCentroidToBuffer(centroidB);
            } else {
                bucket.showCentroid(partA);
            }
        }

        bucket.borderDoneWithNeighborZ[i] = nBucket.canonical.z;
        nBucket.borderDoneWithNeighborZ[j] = bucket.canonical.z;
    }

    if (bucket.needsCentroidUpdate || (!bucket.centroidVertexBuffer && bucket.centroidVertexArray.length !== 0)) {
        bucket.uploadCentroid(context);
    }
}

const XAxis: vec3 = [1, 0, 0];
const YAxis: vec3 = [0, 1, 0];
const ZAxis: vec3 = [0, 0, 1];

function frustumCullShadowCaster(id: OverscaledTileID, bucket: FillExtrusionBucket, painter: Painter): boolean {
    const transform = painter.transform;
    const shadowRenderer = painter.shadowRenderer;
    if (!shadowRenderer) {
        return true;
    }

    const unwrappedId = id.toUnwrapped();

    const ws = transform.tileSize * shadowRenderer._cascades[painter.currentShadowCascade].scale;

    let height = bucket.maxHeight;
    if (transform.elevation) {
        const minmax = transform.elevation.getMinMaxForTile(id);
        if (minmax) {
            height += minmax.max;
        }
    }
    const shadowDir = [...shadowRenderer.shadowDirection] as vec3;
    shadowDir[2] = -shadowDir[2];

    const tileShadowVolume = shadowRenderer.computeSimplifiedTileShadowVolume(unwrappedId, height, ws, shadowDir);
    if (!tileShadowVolume) {
        return false;
    }

    // Projected shadow volume has 3-6 unique edge direction vectors.
    // These are used for computing remaining separating axes for the intersection test
    const edges: vec3[] = [XAxis, YAxis, ZAxis, shadowDir, [shadowDir[0], 0, shadowDir[2]], [0, shadowDir[1], shadowDir[2]]];
    const isGlobe = transform.projection.name === 'globe';
    const zoom = transform.scaleZoom(ws);
    const cameraFrustum = Frustum.fromInvProjectionMatrix(transform.invProjMatrix, transform.worldSize, zoom, !isGlobe);
    const cascadeFrustum = shadowRenderer.getCurrentCascadeFrustum();
    if (cameraFrustum.intersectsPrecise(tileShadowVolume.vertices, tileShadowVolume.planes, edges) === 0) {
        return true;
    }
    if (cascadeFrustum.intersectsPrecise(tileShadowVolume.vertices, tileShadowVolume.planes, edges) === 0) {
        return true;
    }
    return false;
}
