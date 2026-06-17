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
import {lineBlendReduceUniformValues} from './program/line_blend_reduce_program';
import browser from '../util/browser';
import {clamp, nextPowerOfTwo, warnOnce} from '../util/util';
import {calculateGroundShadowFactor} from '../../3d-style/render/shadow_utils';
import {renderColorRamp} from '../util/color_ramp';
import EXTENT from '../style-spec/data/extent';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import assert from '../style-spec/util/assert';
import pixelsToTileUnits from '../source/pixels_to_tile_units';
import Framebuffer from '../gl/framebuffer';
import {HD} from '../../modules/hd_main';

import type Context from '../gl/context';
import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type LineStyleLayer from '../style/style_layer/line_style_layer';
import type LineBucket from '../data/bucket/line_bucket';
import type Program from './program';
import type ProgramConfiguration from '../data/program_configuration';
import type SegmentVector from '../data/segment';
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
            drawLineBlendDraped(painter, sourceCache, layer, coords, blendMode);
            return;
        }
        // Non-draped blend: fullscreen offscreen FBO + composite path.
        if (painter.renderPass === 'offscreen') {
            drawLineToFbo(painter, sourceCache, layer, coords, blendMode);
            return;
        }
        if (painter.renderPass === 'translucent') {
            const fbo = layer.lineBlendFbos && layer.lineBlendFbos.fbo;
            if (fbo) drawLineBlendComposite(painter, layer, blendMode, fbo, null);
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

    const emissiveStrength = layer.paint.get('line-emissive-strength');
    if (!image && emissiveStrength.value.kind !== 'constant' && emissiveStrength.value.isLineProgressConstant === false) {
        definesValues.push("VARIABLE_LINE_EMISSIVE_STRENGTH");
    }

    if (painter._debugParams.showElevationIdDebug) {
        definesValues.push('DEBUG_ELEVATION_ID');
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

    // Collect tiles with partial polygon coverage for second pass stencil rendering.
    // Per-level segments are looked up at draw time via bucket.frcData.frcPerLevel.get(frc) — zero alloc.
    const polygonCoverageTiles: Array<{
        coord: OverscaledTileID; bucket: LineBucket;
        uniformValues: UniformValues<LineUniformsType | LinePatternUniformsType>;
        programConfiguration: ProgramConfiguration;
        program: Program<LineUniformsType | LinePatternUniformsType>;
        depthMode: DepthMode; colorMode: Readonly<ColorMode>;
        frcMask: number;
    }> = [];

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
                    const ignoreLut = layer.paint.get('line-gradient-use-theme').constantOr('default') === 'none';
                    layerGradient.gradient = renderColorRamp({
                        expression: layer.gradientExpression(),
                        evaluationKey: 'lineProgress',
                        resolution: textureResolution,
                        image: layerGradient.gradient || undefined,
                        clips: bucket.lineClipsArray,
                        lut: ignoreLut ? null : layer.lut
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

            if (elevated && !renderElevatedRoads) {
                assert(painter.terrain);
                painter.terrain.setupElevationDraw(tile, program);
            }
            painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

            // FRC coverage routing (snapshot lookup, polygon-geometry probe, second-pass
            // collector push) lives in HD. When HD is not loaded, snapshot is null →
            // detect returns null → renderLine/fade pass below skip the FRC paths.
            const frcCtx = HD.drawLineFrcCoverageDetect ?
                HD.drawLineFrcCoverageDetect(painter, bucket, coord, elevated,
                    uniformValues, programConfiguration, program, depthMode, colorMode,
                    polygonCoverageTiles) :
                null;
            const drawWithSegments = (stencilMode: StencilMode, segs: SegmentVector | undefined, opacityMultiplier?: number) => {
                if (!segs || segs.get().length === 0) return;
                if (lineOpacityForOcclusion != null) {
                    lineOpacityForOcclusion.value = lineOpacity * occlusionOpacity;
                }
                if (opacityMultiplier !== undefined) {
                    uniformValues['u_opacity_multiplier'] = opacityMultiplier;
                }
                program.draw(painter, gl.TRIANGLES, depthMode,
                    stencilMode, colorMode, CullFaceMode.disabled, uniformValues,
                    layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, segs,
                    layer.paint, painter.transform.zoom, programConfiguration, [bucket.layoutVertexBuffer2, bucket.patternVertexBuffer, bucket.zOffsetVertexBuffer, bucket.elevationIdColVertexBuffer, bucket.elevationGroundScaleVertexBuffer]);
                if (opacityMultiplier !== undefined) {
                    uniformValues['u_opacity_multiplier'] = 1.0;
                }
                if (lineOpacityForOcclusion != null) {
                    lineOpacityForOcclusion.value = lineOpacity; //restore
                }
            };

            // First-pass renderLine: draws "above" content. Per-level FRC dispatch (zero
            // alloc — N extra draw calls per uncovered level) is delegated to HD when
            // active. Otherwise the plain draw runs.
            const renderLine = (stencilMode: StencilMode) => {
                if (frcCtx && frcCtx.active && HD.drawLineFrcRenderLine) {
                    HD.drawLineFrcRenderLine(bucket, frcCtx, stencilMode, drawWithSegments);
                } else {
                    drawWithSegments(stencilMode, bucket.segments);
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
            // FRC fade pass for full-tile coverage (Case A): render covered segments at
            // faded opacity. Skipped by HD when partial polygon coverage applies (handled
            // by the second pass below).
            if (frcCtx && HD.drawLineFrcFadePass) {
                HD.drawLineFrcFadePass(painter, bucket, coord, frcCtx, elevated, stencilMode3D, drawWithSegments);
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
        if (elevationReference !== 'hd-road-markup') {
            painter.forceTerrainMode = true;
        }
        renderTiles(coords, definesValues, depthMode, stencilMode3D, true, true);
        if (useStencilMaskRenderPass) {
            renderTiles(coords, definesValues, depthMode, stencilMode3D, true, false);
        }
        // It is important that this precedes resetStencilClippingMasks as in gl-js we don't clear stencil for terrain.
        if (elevationReference !== 'hd-road-markup') {
            painter.forceTerrainMode = false;
        }
    }

    // Second pass: per-FRC-level stencil passes for polygon coverage
    if (HD.drawLineFrcCoverageSecondPass) {
        HD.drawLineFrcCoverageSecondPass(painter, layer, polygonCoverageTiles);
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

export class LineBlendFbos {
    fbo: Framebuffer | null | undefined;
    drapeFbo: Framebuffer | null | undefined;

    destroy() {
        if (this.fbo) {
            this.fbo.destroy();
            this.fbo = null;
        }
        if (this.drapeFbo) {
            this.drapeFbo.destroy();
            this.drapeFbo = null;
        }
    }
}

export class LineBlendDensityReadback {
    pbo: WebGLBuffer;
    sync: WebGLSync | null;
    // Ping-pong FBOs used by the hierarchical reduce passes.
    fboA: Framebuffer | null | undefined;
    fboB: Framebuffer | null | undefined;
    // Cached value from the last completed readback
    maxDensity: number;

    constructor(gl: WebGL2RenderingContext) {
        this.pbo = gl.createBuffer();
        this.sync = null;
        this.fboA = null;
        this.fboB = null;
        this.maxDensity = 0;
    }

    destroy(gl: WebGL2RenderingContext) {
        if (this.sync) {
            gl.deleteSync(this.sync);
            this.sync = null;
        }
        gl.deleteBuffer(this.pbo);
        if (this.fboA) {
            this.fboA.destroy();
            this.fboA = null;
        }
        if (this.fboB) {
            this.fboB.destroy();
            this.fboB = null;
        }
    }
}

type BlendMode = 'additive' | 'multiply';
const blendModeSetup: Record<BlendMode, {clearColor: Color, colorMode?: ColorMode, compositeUniformValue: number}> = {
    'additive': {
        clearColor: new Color(0, 0, 0, 0),
        colorMode: ColorMode.additiveAlphaWeighted,
        compositeUniformValue: LINE_BLEND_MODE_ADDITIVE,
    },
    'multiply': {
        clearColor: new Color(1, 1, 1, 1),
        colorMode: ColorMode.multiply,
        compositeUniformValue: LINE_BLEND_MODE_MULTIPLY,
    }
};

function hasFloatRenderTarget(context: Context): boolean {
    return !!(context.extRenderToTextureHalfFloat || context.extColorBufferFloat);
}

function getColorMode(blendMode: BlendMode, context: Context): Readonly<ColorMode> {
    if (blendMode === 'additive' && hasFloatRenderTarget(context)) {
        // For additive blend when RGBA16F is supported we can accumulate alpha >1.0
        // and store density information for a better composite
        return ColorMode.additiveAlphaWeightedUnboundedAlpha;
    }
    return blendModeSetup[blendMode].colorMode;
}

function scheduleGpuReduceReadback(painter: Painter, layer: LineStyleLayer, sourceFbo: Framebuffer) {
    const context = painter.context;
    const gl = context.gl;

    // --- Reduce passes: halve resolution until we reach 1×1 ---
    let srcWidth = sourceFbo.width;
    let srcHeight = sourceFbo.height;
    let srcTexture = sourceFbo.colorAttachment0.get();

    // Create or reuse the readback object before the reduce loop so the
    // ping-pong FBOs can be stored on it.
    if (!layer.lineBlendDensityReadback) {
        layer.lineBlendDensityReadback = new LineBlendDensityReadback(gl);
    }
    const readback = layer.lineBlendDensityReadback;

    // Ping-pong between two cached FBOs each pass,
    // repeatedly halving the resolution until we reach 1×1.
    let slotIndex = 0;
    let firstPass = true;

    while (srcWidth > 1 || srcHeight > 1) {
        const dstWidth = Math.max(1, Math.floor(srcWidth / 2));
        const dstHeight = Math.max(1, Math.floor(srcHeight / 2));

        const slot = slotIndex === 0 ? 'fboA' : 'fboB';
        readback[slot] = Framebuffer.createWithTexture(context, readback[slot], dstWidth, dstHeight, false);
        const dstFbo = readback[slot];

        context.bindFramebuffer.set(dstFbo.framebuffer);
        context.viewport.set([0, 0, dstWidth, dstHeight]);

        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, srcTexture);

        painter.getOrCreateProgram('lineBlendReduce').draw(
            painter, gl.TRIANGLES,
            DepthMode.disabled, StencilMode.disabled,
            ColorMode.unblended, CullFaceMode.disabled,
            lineBlendReduceUniformValues(0, [1 / srcWidth, 1 / srcHeight], firstPass),
            layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
            painter.viewportSegments, layer.paint, painter.transform.zoom,
        );

        srcWidth = dstWidth;
        srcHeight = dstHeight;
        srcTexture = dstFbo.colorAttachment0.get();
        slotIndex = 1 - slotIndex;
        firstPass = false;
    }

    // --- Async readback into a PBO ---
    const isFloat = hasFloatRenderTarget(context);
    const byteLength = isFloat ? 16 : 4;

    // Discard previous fence — we replace it with this frame's result.
    if (readback.sync) {
        gl.deleteSync(readback.sync);
        readback.sync = null;
    }

    // readPixels with a bound PIXEL_PACK_BUFFER is non-blocking: the GPU
    // writes the result into the PBO asynchronously and this call returns
    // immediately without stalling the CPU.
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readback.pbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, byteLength, gl.STREAM_READ);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, isFloat ? gl.FLOAT : gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

    // Fence sync so we can poll for completion next frame without blocking.
    readback.sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);

    // Restore viewport to the full painter dimensions.
    context.viewport.set([0, 0, painter.width, painter.height]);
}

function pollAndConsumeReduceReadback(readback: LineBlendDensityReadback, gl: WebGL2RenderingContext, context: Context) {
    if (!readback.sync) return;

    // Use getSyncParameter rather than clientWaitSync. The WebGL2 spec
    // guarantees a sync object cannot transition to SIGNALED in the same frame
    // it was created, so clientWaitSync with timeout=0 always returns
    // TIMEOUT_EXPIRED within the issuing frame. getSyncParameter correctly
    // returns SIGNALED on a subsequent frame without that restriction.
    const status = gl.getSyncParameter(readback.sync, gl.SYNC_STATUS) as GLenum;
    if (status !== gl.SIGNALED) return;

    // Fence signalled — PBO data is ready to read on the CPU.
    gl.deleteSync(readback.sync);
    readback.sync = null;

    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, readback.pbo);
    if (hasFloatRenderTarget(context)) {
        const pixel = new Float32Array(4);
        gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixel);
        const densitySum = pixel[0];
        const count = pixel[1];
        const meanOccupiedDensity = count > 0 ? densitySum / count : 0;

        // place the occupied mean in the center of the tone-mapping curve
        const SCALE = 2.0;
        readback.maxDensity = Math.max(meanOccupiedDensity * SCALE, 1);
    } else {
        readback.maxDensity = 1;
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
}

// Returns the cached max density value for the composite shader, or null if no
// GPU result has been received yet. A null return means the caller should skip
// compositing entirely — hiding the layer until the first real value arrives
// rather than flashing at full brightness with an incorrect default.
function resolveMaxDensity(painter: Painter, layer: LineStyleLayer): number | null {
    const clamp = layer.paint.get('line-blend-additive-clamp');
    if (clamp > 0) return clamp;
    const readback = layer.lineBlendDensityReadback;
    if (!readback || readback.maxDensity === 0) return null;
    return readback.maxDensity;
}

// Called after the FBO has been rendered into. Polls any outstanding fence then
// either waits or schedules a fresh readback.
//
// triggerRepaint is called only once, immediately after a new readback is
// scheduled, to guarantee the fence is polled even if the map would otherwise
// go idle. While a sync is already in flight but not yet signalled we do NOT
// call triggerRepaint — we simply wait for the next natural render (tile load,
// camera move, etc.) to poll it. This prevents an idle render loop when the GPU
// is slow to signal (e.g. Firefox).
function updateDensityReadback(painter: Painter, layer: LineStyleLayer, fbo: Framebuffer) {
    if (!hasFloatRenderTarget(painter.context)) return;

    const gl = painter.context.gl;
    const readback = layer.lineBlendDensityReadback;

    if (readback && readback.sync) {
        // A readback is already in flight — poll without rescheduling.
        pollAndConsumeReduceReadback(readback, gl, painter.context);

        if (!readback.sync) {
            // Fence was just consumed — schedule a fresh readback from the
            // current FBO and request one follow-up frame to collect it.
            scheduleGpuReduceReadback(painter, layer, fbo);
            painter.style.map.triggerRepaint();
        }
        // If sync is still set the GPU isn't done yet. Do nothing — the next
        // natural render will poll again without us forcing an extra frame.
    } else {
        // No sync in flight — schedule the first (or next) readback and
        // request one follow-up frame so the fence can be polled.
        scheduleGpuReduceReadback(painter, layer, fbo);
        painter.style.map.triggerRepaint();
    }
}

function drawLineToFbo(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>, blendMode: BlendMode) {
    const context = painter.context;

    const width = Math.ceil(painter.width);
    const height = Math.ceil(painter.height);
    if (!layer.lineBlendFbos) layer.lineBlendFbos = new LineBlendFbos();
    layer.lineBlendFbos.fbo = Framebuffer.createWithTexture(context, layer.lineBlendFbos.fbo, width, height, true);

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

    drawLineTiles(painter, sourceCache, layer, coords, getColorMode(blendMode, painter.context));

    painter.renderPass = savedRenderPass;

    painter.currentStencilSource = savedStencilSource;
    painter._tileClippingMaskIDs = savedStencilIDs;
    painter.nextStencilID = savedNextStencilID;

    context.viewport.set([0, 0, painter.width, painter.height]);

    if (blendMode === 'additive') {
        updateDensityReadback(painter, layer, layer.lineBlendFbos.fbo);
    }
}

function drawLineBlendComposite(
    painter: Painter,
    layer: LineStyleLayer,
    blendMode: BlendMode,
    sourceFbo: Framebuffer,
    targetFbo: Framebuffer | WebGLFramebuffer | null,
    viewport?: [number, number]
) {
    const context = painter.context;
    const gl = context.gl;

    const opacity = blendMode === 'additive' ? 1.0 : layer.paint.get('line-opacity').constantOr(1);
    const maxDensity = blendMode === 'additive' ? resolveMaxDensity(painter, layer) : 1.0;

    // No GPU result yet — skip compositing to avoid a full-brightness flash on
    // the first frames before the async readback has completed.
    if (maxDensity === null) return;

    context.bindFramebuffer.set(targetFbo);
    if (viewport) {
        context.viewport.set([0, 0, viewport[0], viewport[1]]);
    }

    context.activeTexture.set(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceFbo.colorAttachment0.get());

    const colorMode = getColorMode(blendMode, painter.context);

    painter.getOrCreateProgram('lineBlendComposite').draw(painter, gl.TRIANGLES,
        DepthMode.disabled, StencilMode.disabled, colorMode, CullFaceMode.disabled,
        lineBlendCompositeUniformValues(0, opacity, blendModeSetup[blendMode].compositeUniformValue, maxDensity),
        layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
        painter.viewportSegments, layer.paint, painter.transform.zoom);
}

function drawLineBlendDraped(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>, blendMode: BlendMode) {
    if (painter.renderPass !== 'translucent') return;

    const context = painter.context;
    const gl = context.gl;
    const terrain = painter.terrain;
    if (!terrain) return;

    const drapeFbo = context.bindFramebuffer.current;

    const isMrt = painter.emissiveMode === 'mrt-fallback';

    const drapeWidth = terrain.drapeBufferSize[0];
    const drapeHeight = terrain.drapeBufferSize[1];
    if (!layer.lineBlendFbos) layer.lineBlendFbos = new LineBlendFbos();
    layer.lineBlendFbos.drapeFbo = Framebuffer.createWithTexture(context, layer.lineBlendFbos.drapeFbo, drapeWidth, drapeHeight, true);

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
    drawLineTiles(painter, sourceCache, layer, coords, getColorMode(blendMode, painter.context), true);

    painter._terrain = savedTerrain;

    painter.currentStencilSource = savedStencilSource;
    painter._tileClippingMaskIDs = savedStencilIDs;
    painter.nextStencilID = savedNextStencilID;

    if (isMrt) {
        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    }

    const bufferSize = terrain.drapeBufferSize;
    const fbo = layer.lineBlendFbos && layer.lineBlendFbos.drapeFbo;
    if (!fbo) return;

    if (blendMode === 'additive') {
        updateDensityReadback(painter, layer, fbo);
    }

    drawLineBlendComposite(painter, layer, blendMode, fbo, drapeFbo, bufferSize);
}
