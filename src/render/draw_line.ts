import Color from '../style-spec/util/color';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import ColorMode from '../gl/color_mode';
import StencilMode from '../gl/stencil_mode';
import Texture from './texture';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineDefinesValues
} from './program/line_program';
import {lineBlendCompositeUniformValues, LINE_BLEND_MODE_MULTIPLY, LINE_BLEND_MODE_ADDITIVE} from './program/line_blend_composite_program';
import browser from '../util/browser';
import {clamp, nextPowerOfTwo, warnOnce} from '../util/util';
import {calculateGroundShadowFactor} from '../../3d-style/render/shadow_renderer';
import {renderColorRamp} from '../util/color_ramp';
import EXTENT from '../style-spec/data/extent';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import assert from 'assert';
import pixelsToTileUnits from '../source/pixels_to_tile_units';
import Framebuffer from '../gl/framebuffer';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type LineStyleLayer from '../style/style_layer/line_style_layer';
import type LineBucket from '../data/bucket/line_bucket';
import type {UniformValues} from './uniform_binding';
import type {OverscaledTileID} from '../source/tile_id';
import type {DynamicDefinesType} from './program/program_uniforms';
import type {LineUniformsType, LinePatternUniformsType} from './program/line_program';

export function prepare(layer: LineStyleLayer, sourceCache: SourceCache, painter: Painter) {
    layer.hasElevatedBuckets = false;
    layer.hasNonElevatedBuckets = false;

    // Prepare() is only needed when there is a possibility that elevated buckets exist
    if (layer._unevaluatedLayout.getValue('line-elevation-reference') === undefined && layer._unevaluatedLayout.getValue('line-z-offset') === undefined) {
        layer.hasNonElevatedBuckets = true;
        return;
    }

    if (sourceCache) {
        const coords = sourceCache.getVisibleCoordinates();
        for (const coord of coords) {
            const tile = sourceCache.getTile(coord);
            const bucket: LineBucket | undefined = tile.getBucket(layer) as LineBucket;
            if (!bucket) continue;
            if (bucket.elevationType !== 'none') {
                layer.hasElevatedBuckets = true;
            } else {
                layer.hasNonElevatedBuckets = true;
            }
            if (layer.hasElevatedBuckets && layer.hasNonElevatedBuckets) {
                break;
            }
        }
    }
}

export default function drawLine(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>) {
    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');

    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    const blendMode = layer.paint.get('line-blend-mode');
    const isDraping = painter.terrain && painter.terrain.renderingToTexture;

    if (blendMode !== 'default' && painter.transform.projection.name !== 'globe') {
        if (isDraping) {
            renderLineBlendDraped(painter, sourceCache, layer, coords, blendMode);
            return;
        }
        // Non-draped blend: fullscreen offscreen FBO + composite path.
        if (painter.renderPass === 'offscreen') {
            renderLineToFbo(painter, sourceCache, layer, coords, blendMode);
            return;
        }
        if (painter.renderPass === 'translucent') {
            compositeLineFbo(painter, layer, blendMode);
            return;
        }
        return;
    }

    if (painter.renderPass !== 'translucent') return;

    drawLineTiles(painter, sourceCache, layer, coords);
}

function drawLineTiles(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>, colorModeOverride?: Readonly<ColorMode>, forceDrapingMatrix?: boolean) {
    const width = layer.paint.get('line-width');
    const constantEmissiveStrength = layer.paint.get('line-emissive-strength').isConstant();
    assert(painter.emissiveMode !== 'constant' || constantEmissiveStrength);
    const emissiveStrengthForDrapedLayers = layer.paint.get('line-emissive-strength').constantOr(0.0);
    const occlusionOpacity = layer.paint.get('line-occlusion-opacity');
    const elevationReference = layer.layout.get('line-elevation-reference');
    const unitInMeters = layer.layout.get('line-width-unit') === 'meters';
    const elevationFromSea = elevationReference === 'sea';
    const terrainEnabled = !!(painter.terrain && painter.terrain.enabled);

    const context = painter.context;
    const gl = context.gl;

    // line-z-offset is not supported for globe projection
    if (layer.hasElevatedBuckets && painter.transform.projection.name === 'globe') return;

    const crossSlope = layer.layout.get('line-cross-slope');
    const hasCrossSlope = crossSlope !== undefined;
    const crossSlopeHorizontal = crossSlope < 1.0;

    const colorMode = colorModeOverride ? colorModeOverride : painter.colorModeForDrapableLayerRenderPass(constantEmissiveStrength ? emissiveStrengthForDrapedLayers : null);
    const isDraping = (painter.terrain && painter.terrain.renderingToTexture) || forceDrapingMatrix;
    const pixelRatio = isDraping ? 1.0 : browser.devicePixelRatio;

    const dasharrayProperty = layer.paint.get('line-dasharray');

    const dasharray = dasharrayProperty.constantOr(1);
    const capProperty = layer.layout.get('line-cap');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const constantDash = dasharrayProperty.constantOr(null);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const constantCap = capProperty.constantOr(null);
    const patternProperty = layer.paint.get('line-pattern');

    const image = patternProperty.constantOr(1);
    const patternTransition = layer.paint.get('line-pattern-cross-fade');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const constantPattern = patternProperty.constantOr(null);

    const lineOpacity = layer.paint.get('line-opacity').constantOr(1.0);
    const hasOpacity = lineOpacity !== 1.0;
    let useStencilMaskRenderPass = (!image && hasOpacity) ||
    // Only semi-transparent lines need stencil masking
        (painter.depthOcclusion && occlusionOpacity > 0 && occlusionOpacity < 1);

    const gradient = layer.paint.get('line-gradient');

    const programId = image ? 'linePattern' : 'line';

    const definesValues = (lineDefinesValues(layer) as DynamicDefinesType[]);
    if (isDraping && painter.terrain && painter.terrain.clipOrMaskOverlapStencilType()) {
        useStencilMaskRenderPass = false;
    }

    // line opacity uniform gets amended by line occlusion opacity
    let lineOpacityForOcclusion: {value: number} | undefined;
    if (occlusionOpacity !== 0 && painter.depthOcclusion) {
        const value = layer.paint._values["line-opacity"];

        if (value && value.value && value.value.kind === "constant") {

            lineOpacityForOcclusion = value.value;
        } else {
            warnOnce(`Occlusion opacity for layer ${layer.id} is supported only when line-opacity isn't data-driven.`);
        }
    }

    if (width.value.kind !== 'constant' && width.value.isLineProgressConstant === false) {
        definesValues.push("VARIABLE_LINE_WIDTH");
    }

    if (isDraping) {
        if (painter.emissiveMode === 'dual-source-blending' && !constantEmissiveStrength) {
            definesValues.push('DUAL_SOURCE_BLENDING');
        } else if (painter.emissiveMode === 'mrt-fallback') {
            definesValues.push('USE_MRT1');
        }
    }

    // Cache line-width evaluation per bucket zoom for dash anchoring to avoid evaluating per tile.
    const floorwidthByZoom: Record<number, number> = {};

    const renderTiles = (coords: OverscaledTileID[], baseDefines: DynamicDefinesType[], depthMode: DepthMode, stencilMode3D: StencilMode, elevated: boolean, firstPass: boolean) => {
        for (const coord of coords) {
            const tile = sourceCache.getTile(coord);
            if (image && !tile.patternsLoaded()) continue;

            const bucket = tile.getBucket(layer) as LineBucket;
            if (!bucket) continue;
            if ((bucket.elevationType !== 'none' && !elevated) || (bucket.elevationType === 'none' && elevated)) continue;

            painter.prepareDrawTile();

            const defines = [...baseDefines];
            const renderElevatedRoads = bucket.elevationType === 'road';
            const shadowRenderer = painter.shadowRenderer;
            const renderWithShadows = renderElevatedRoads && !!shadowRenderer && shadowRenderer.enabled;
            let groundShadowFactor: [number, number, number] = [0, 0, 0];
            if (renderWithShadows) {
                const directionalLight = painter.style.directionalLight;
                const ambientLight = painter.style.ambientLight;
                if (directionalLight && ambientLight) {
                    groundShadowFactor = calculateGroundShadowFactor(painter.style, directionalLight, ambientLight);
                }
                defines.push('RENDER_SHADOWS', 'NORMAL_OFFSET');
            }

            const programConfiguration = bucket.programConfigurations.get(layer.id);

            let transitionableConstantPattern = false;
            if (constantPattern && tile.imageAtlas) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const pattern = ResolvedImage.from(constantPattern);
                const primaryPatternImage = pattern.getPrimary().scaleSelf(pixelRatio).toString();
                const primaryPosTo = tile.imageAtlas.patternPositions.get(primaryPatternImage);
                const secondaryPatternImageVariant = pattern.getSecondary();
                const secondaryPosTo = secondaryPatternImageVariant ? tile.imageAtlas.patternPositions.get(secondaryPatternImageVariant.scaleSelf(pixelRatio).toString()) : null;

                transitionableConstantPattern = !!primaryPosTo && !!secondaryPosTo;

                if (primaryPosTo) programConfiguration.setConstantPatternPositions(primaryPosTo, secondaryPosTo);
            }

            if (patternTransition > 0 && (transitionableConstantPattern || !!programConfiguration.getPatternTransitionVertexBuffer('line-pattern'))) {
                defines.push('LINE_PATTERN_TRANSITION');
            }

            if (bucket.elevationGroundScaleVertexBuffer) {
                defines.push('ELEVATION_GROUND_SCALE');
            }

            const affectedByFog = painter.isTileAffectedByFog(coord);
            const program = painter.getOrCreateProgram(programId, {config: programConfiguration, defines, overrideFog: affectedByFog});

            if (!image && constantDash && constantCap && tile.lineAtlas) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const posTo = tile.lineAtlas.getDash(constantDash, constantCap);
                if (posTo) programConfiguration.setConstantPatternPositions(posTo);
            }

            if (renderWithShadows) {
                shadowRenderer.setupShadows(tile.tileID.toUnwrapped(), program, 'vector-tile');
            }

            let [trimStart, trimEnd] = layer.paint.get('line-trim-offset');
            // When line cap is 'round' or 'square', the whole line progress will beyond 1.0 or less than 0.0.
            // If trim_offset begin is line begin (0.0), or trim_offset end is line end (1.0), adjust the trim
            // offset with fake offset shift so that the line_progress < 0.0 or line_progress > 1.0 part will be
            // correctly covered.
            if (constantCap === 'round' || constantCap === 'square') {
                // Fake the percentage so that it will cover the round/square cap that is beyond whole line
                const fakeOffsetShift = 1.0;
                // To make sure that the trim offset range is effecive
                if (trimStart !== trimEnd) {
                    if (trimStart === 0.0) {
                        trimStart -= fakeOffsetShift;
                    }
                    if (trimEnd === 1.0) {
                        trimEnd += fakeOffsetShift;
                    }
                }
            }

            const matrix = isDraping ? coord.projMatrix : null;
            const lineWidthScale = unitInMeters ? (1.0 / bucket.tileToMeter) / pixelsToTileUnits(tile, 1, painter.transform.zoom) : 1.0;
            const lineFloorWidthScale = unitInMeters ? (1.0 / bucket.tileToMeter) / pixelsToTileUnits(tile, 1, Math.floor(painter.transform.zoom)) : 1.0;

            // Avoid dash flickering while loading ideal tiles on zoom level traversal.
            // Override the floorwidth paint property to use width evaluated at bucket zoom
            // instead of camera zoom. This ensures stable dash texture coordinates when an
            // overscaled lower-zoom tile is temporarily rendered. Restore after draw.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const widthProperty: {value: {kind: string; value: number}} | null = dasharray ? (layer.paint as any)._values['line-floorwidth'] : null;
            let savedFloorwidth: number | undefined;
            if (widthProperty && widthProperty.value.kind === 'constant') {
                const bz = bucket.zoom;
                if (!(bz in floorwidthByZoom)) {
                    floorwidthByZoom[bz] = Math.max(0.01, layer.widthExpression().evaluate({zoom: bz}));
                }
                savedFloorwidth = widthProperty.value.value;
                const floorZoom = Math.floor(painter.transform.zoom);
                const zoomDiff = floorZoom - tile.tileID.overscaledZ;
                widthProperty.value.value = floorwidthByZoom[bz] * Math.pow(2, zoomDiff);
            }

            const uniformValues: UniformValues<LineUniformsType | LinePatternUniformsType> = image ?
                linePatternUniformValues(painter, tile, layer, matrix, pixelRatio, lineWidthScale, lineFloorWidthScale, [trimStart, trimEnd], groundShadowFactor, patternTransition) :
                lineUniformValues(painter, tile, layer, matrix, bucket.lineClipsArray.length, pixelRatio, lineWidthScale, lineFloorWidthScale, [trimStart, trimEnd], groundShadowFactor);

            if (gradient) {
                const layerGradient = bucket.gradients[layer.id];
                let gradientTexture = layerGradient.texture;
                if (layer.gradientVersion !== layerGradient.version) {
                    let textureResolution = 256;
                    if (layer.stepInterpolant) {
                        const sourceMaxZoom = sourceCache.getSource().maxzoom;
                        const potentialOverzoom = coord.canonical.z === sourceMaxZoom ?
                            Math.ceil(1 << (painter.transform.maxZoom - coord.canonical.z)) : 1;
                        const lineLength = bucket.maxLineLength / EXTENT;
                        // Logical pixel tile size is 512px, and 1024px right before current zoom + 1
                        const maxTilePixelSize = 1024;
                        // Maximum possible texture coverage heuristic, bound by hardware max texture size
                        const maxTextureCoverage = lineLength * maxTilePixelSize * potentialOverzoom;
                        textureResolution = clamp(nextPowerOfTwo(maxTextureCoverage), 256, context.maxTextureSize);
                    }
                    layerGradient.gradient = renderColorRamp({
                        expression: layer.gradientExpression(),
                        evaluationKey: 'lineProgress',
                        resolution: textureResolution,
                        image: layerGradient.gradient || undefined,
                        clips: bucket.lineClipsArray
                    });
                    if (layerGradient.texture) {
                        layerGradient.texture.update(layerGradient.gradient);
                    } else {
                        layerGradient.texture = new Texture(context, layerGradient.gradient, gl.RGBA8);
                    }
                    layerGradient.version = layer.gradientVersion;
                    gradientTexture = layerGradient.texture;
                }
                context.activeTexture.set(gl.TEXTURE1);
                gradientTexture.bind(layer.stepInterpolant ? gl.NEAREST : gl.LINEAR, gl.CLAMP_TO_EDGE);
            }
            if (dasharray) {
                context.activeTexture.set(gl.TEXTURE0);
                if (tile.lineAtlasTexture) {
                    tile.lineAtlasTexture.bind(gl.LINEAR, gl.REPEAT);
                }
                programConfiguration.updatePaintBuffers();
            }
            if (image) {
                context.activeTexture.set(gl.TEXTURE0);
                if (tile.imageAtlasTexture) {
                    tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
                }
                programConfiguration.updatePaintBuffers();
            }

            if (elevated) {
                assert(painter.terrain);
                painter.terrain.setupElevationDraw(tile, program);
            }
            painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

            const renderLine = (stencilMode: StencilMode) => {
                if (lineOpacityForOcclusion != null) {
                    lineOpacityForOcclusion.value = lineOpacity * occlusionOpacity;
                }
                program.draw(painter, gl.TRIANGLES, depthMode,
                    stencilMode, colorMode, CullFaceMode.disabled, uniformValues,
                    layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
                    layer.paint, painter.transform.zoom, programConfiguration, [bucket.layoutVertexBuffer2, bucket.patternVertexBuffer, bucket.zOffsetVertexBuffer, bucket.elevationGroundScaleVertexBuffer]);
                if (lineOpacityForOcclusion != null) {
                    lineOpacityForOcclusion.value = lineOpacity; //restore
                }
            };

            if (useStencilMaskRenderPass && !elevated) {
                const stencilId = painter.stencilModeForClipping(coord).ref;
                // When terrain is on, ensure that the stencil buffer has 0 values.
                // As stencil may be disabled when it is not in overlapping stencil
                // mode. Refer to stencilModeForRTTOverlap logic.
                const needsClearing = stencilId === 0 && isDraping;
                if (needsClearing) {
                    context.clear({stencil: 0});
                }
                const stencilFunc = {func: gl.EQUAL, mask: 0xFF};

                // Allow line geometry fragment to be drawn only once:
                // - Invert the stencil identifier left by stencil clipping, this
                // ensures that we are not conflicting with neighborhing tiles.
                // - Draw Anti-Aliased pixels with a threshold set to 0.8, this
                // may draw Anti-Aliased pixels more than once, but due to their
                // low opacity, these pixels are usually invisible and potential
                // overlapping pixel artifacts locally minimized.
                uniformValues['u_alpha_discard_threshold'] = 0.8;
                renderLine(new StencilMode(stencilFunc, stencilId, 0xFF, gl.KEEP, gl.KEEP, gl.INVERT));
                uniformValues['u_alpha_discard_threshold'] = 0.0;
                renderLine(new StencilMode(stencilFunc, stencilId, 0xFF, gl.KEEP, gl.KEEP, gl.KEEP));
            } else {
                // Same logic as in the non-elevated case,
                // but we need to draw all tiles in batches to support 3D stencil mode.
                if (useStencilMaskRenderPass && elevated && firstPass) {
                    uniformValues['u_alpha_discard_threshold'] = 0.8;
                } else {
                    uniformValues['u_alpha_discard_threshold'] = 0.0;
                }
                renderLine(elevated ? stencilMode3D : painter.stencilModeForClipping(coord));
            }
            // Restore floorwidth paint property after draw
            if (savedFloorwidth !== undefined) {
                widthProperty.value.value = savedFloorwidth;
            }
        }
    };

    let depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const depthModeFor3D = new DepthMode(painter.depthOcclusion ? gl.GREATER : gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D);

    if (layer.hasNonElevatedBuckets) {
        const terrainEnabledImmediateMode = !isDraping && painter.terrain;
        if (occlusionOpacity !== 0 && terrainEnabledImmediateMode) {
            warnOnce(`Occlusion opacity for layer ${layer.id} is supported on terrain only if the layer has line-z-offset enabled.`);
        } else {
            if (!terrainEnabledImmediateMode) {
                const stencilMode3D = StencilMode.disabled;
                renderTiles(coords, definesValues, depthMode, stencilMode3D, false, true);
            } else {
                // Skip rendering of non-elevated lines in immediate mode when terrain is enabled.
                // This happens only when the line layer has both elevated and non-elevated buckets
                // and will result in only the elevated buckets being rendered.
                warnOnce(`Cannot render non-elevated lines in immediate mode when terrain is enabled. Layer: ${layer.id}.`);
            }
        }
    }

    if (layer.hasElevatedBuckets) {
        if (elevationReference === 'hd-road-markup') {
            if (!terrainEnabled) {
                depthMode = depthModeFor3D;
                definesValues.push('ELEVATED_ROADS');
            }
        } else {
            definesValues.push("ELEVATED");
            depthMode = depthModeFor3D;
            if (hasCrossSlope) {
                definesValues.push(crossSlopeHorizontal ? "CROSS_SLOPE_HORIZONTAL" : "CROSS_SLOPE_VERTICAL");
            }
            if (elevationFromSea) {
                definesValues.push('ELEVATION_REFERENCE_SEA');
            }
        }

        // No need for tile clipping, a single pass only even for transparent lines.
        const stencilMode3D = useStencilMaskRenderPass ? painter.stencilModeFor3D() : StencilMode.disabled;
        painter.forceTerrainMode = true;
        renderTiles(coords, definesValues, depthMode, stencilMode3D, true, true);
        if (useStencilMaskRenderPass) {
            renderTiles(coords, definesValues, depthMode, stencilMode3D, true, false);
        }
        // It is important that this precedes resetStencilClippingMasks as in gl-js we don't clear stencil for terrain.
        painter.forceTerrainMode = false;
    }

    // When rendering to stencil, reset the mask to make sure that the tile
    // clipping reverts the stencil mask we may have drawn in the buffer.
    // The stamp could be reverted by an extra draw call of line geometry,
    // but tile clipping drawing is usually faster to draw than lines.
    if (useStencilMaskRenderPass) {
        painter.resetStencilClippingMasks();
        if (isDraping) { context.clear({stencil: 0}); }
    }

    if (occlusionOpacity !== 0 && !painter.depthOcclusion && !isDraping) {
        painter.layersWithOcclusionOpacity.push(painter.currentLayer);
    }
}

type BlendMode = 'additive' | 'multiply';
const blendModeSetup: Record<BlendMode, {clearColor: Color, colorMode: ColorMode, compositeUniformValue: number}> = {
    'additive': {
        clearColor: new Color(0, 0, 0, 0),
        colorMode: ColorMode.additive,
        compositeUniformValue: LINE_BLEND_MODE_ADDITIVE,
    },
    'multiply': {
        clearColor: new Color(1, 1, 1, 1),
        colorMode: ColorMode.multiply,
        compositeUniformValue: LINE_BLEND_MODE_MULTIPLY,
    }
};

function renderLineToFbo(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>, blendMode: BlendMode) {
    const context = painter.context;

    const width = Math.ceil(painter.width);
    const height = Math.ceil(painter.height);
    layer.lineBlendFbo = Framebuffer.createWithTexture(context, layer.lineBlendFbo, width, height, true);
    layer.lineBlendStencil = layer.lineBlendFbo._stencilRbo;

    context.clear({color: blendModeSetup[blendMode].clearColor, depth: 1, stencil: 0});

    const savedStencilSource = painter.currentStencilSource;
    const savedStencilIDs = painter._tileClippingMaskIDs;
    const savedNextStencilID = painter.nextStencilID;
    painter.currentStencilSource = undefined;
    painter._tileClippingMaskIDs = {};
    painter.nextStencilID = 1;
    painter._renderTileClippingMasks(layer, sourceCache, coords);

    const savedRenderPass = painter.renderPass;
    painter.renderPass = 'translucent';

    drawLineTiles(painter, sourceCache, layer, coords, blendModeSetup[blendMode].colorMode);

    painter.renderPass = savedRenderPass;

    painter.currentStencilSource = savedStencilSource;
    painter._tileClippingMaskIDs = savedStencilIDs;
    painter.nextStencilID = savedNextStencilID;

    context.viewport.set([0, 0, painter.width, painter.height]);
}

function compositeLineFbo(painter: Painter, layer: LineStyleLayer, blendMode: BlendMode) {
    const context = painter.context;
    const gl = context.gl;

    const fbo = layer.lineBlendFbo;
    if (!fbo) return;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment0.get());

    // For additive mode, per-line opacity is already accumulated
    const opacity = blendMode === 'additive' ? 1.0 : layer.paint.get('line-opacity').constantOr(1);

    // For additive, use existing alpha-blend path via colorModeForDrapableLayerRenderPass.
    const colorMode = blendMode === 'additive' ?
        painter.colorModeForDrapableLayerRenderPass(layer.paint.get('line-emissive-strength').constantOr(0.0)) :
        blendModeSetup[blendMode].colorMode;

    painter.getOrCreateProgram('lineBlendComposite').draw(painter, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, colorMode, CullFaceMode.disabled,
        lineBlendCompositeUniformValues(0, opacity, blendModeSetup[blendMode].compositeUniformValue),
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

function renderLineBlendDraped(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>, blendMode: BlendMode) {
    if (painter.renderPass !== 'translucent') return;

    const context = painter.context;
    const gl = context.gl;
    const terrain = painter.terrain;
    if (!terrain) return;

    const drapeFbo = context.bindFramebuffer.current;

    const isMrt = painter.emissiveMode === 'mrt-fallback';

    const drapeWidth = terrain.drapeBufferSize[0];
    const drapeHeight = terrain.drapeBufferSize[1];
    layer.lineBlendDrapeFbo = Framebuffer.createWithTexture(context, layer.lineBlendDrapeFbo, drapeWidth, drapeHeight, true);
    layer.lineBlendDrapeStencil = layer.lineBlendDrapeFbo._stencilRbo;

    if (isMrt) {
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    }

    context.clear({color: blendModeSetup[blendMode].clearColor, depth: 1, stencil: 0});

    const savedStencilSource = painter.currentStencilSource;
    const savedStencilIDs = painter._tileClippingMaskIDs;
    const savedNextStencilID = painter.nextStencilID;
    painter.currentStencilSource = undefined;
    painter._tileClippingMaskIDs = {};
    painter.nextStencilID = 1;

    const savedTerrain = painter._terrain;
    painter._terrain = null;
    painter._renderTileClippingMasks(layer, sourceCache, coords);

    // Force draping matrix since we temporarily set painter._terrain = null
    // but still need terrain-style projection for globe/terrain rendering
    drawLineTiles(painter, sourceCache, layer, coords, blendModeSetup[blendMode].colorMode, true);

    painter._terrain = savedTerrain;

    painter.currentStencilSource = savedStencilSource;
    painter._tileClippingMaskIDs = savedStencilIDs;
    painter.nextStencilID = savedNextStencilID;

    context.bindFramebuffer.set(drapeFbo);

    if (isMrt) {
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    }

    const bufferSize = terrain.drapeBufferSize;
    context.viewport.set([0, 0, bufferSize[0], bufferSize[1]]);

    const fbo = layer.lineBlendDrapeFbo;
    if (!fbo) return;

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment0.get());

    const opacity = blendMode === 'additive' ? 1.0 : layer.paint.get('line-opacity').constantOr(1);
    const emissiveStrength = layer.paint.get('line-emissive-strength').constantOr(0.0);

    const drapeColorMode = blendMode === 'additive' ?
        painter.colorModeForDrapableLayerRenderPass(emissiveStrength) :
        blendModeSetup[blendMode].colorMode;

    painter.getOrCreateProgram('lineBlendComposite').draw(painter, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled,
        drapeColorMode,
        CullFaceMode.disabled,
        lineBlendCompositeUniformValues(0, opacity, blendModeSetup[blendMode].compositeUniformValue),
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

