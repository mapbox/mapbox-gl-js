import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import StencilMode from '../gl/stencil_mode';
import Texture from './texture';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineDefinesValues
} from './program/line_program';
import browser from '../util/browser';
import {clamp, nextPowerOfTwo, warnOnce} from '../util/util';
import {renderColorRamp} from '../util/color_ramp';
import EXTENT from '../style-spec/data/extent';
import ResolvedImage from '../style-spec/expression/types/resolved_image';
import assert from 'assert';
import pixelsToTileUnits from '../source/pixels_to_tile_units';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type LineStyleLayer from '../style/style_layer/line_style_layer';
import type LineBucket from '../data/bucket/line_bucket';
import type {OverscaledTileID} from '../source/tile_id';
import type {DynamicDefinesType} from './program/program_uniforms';

export default function drawLine(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');

    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    const emissiveStrength = layer.paint.get('line-emissive-strength');
    const occlusionOpacity = layer.paint.get('line-occlusion-opacity');
    const elevationReference = layer.layout.get('line-elevation-reference');
    const unitInMeters = layer.layout.get('line-width-unit') === 'meters';
    const elevationFromSea = elevationReference === 'sea';

    const context = painter.context;
    const gl = context.gl;

    const hasZOffset = !layer.isDraped();
    // line-z-offset is not supported for globe projection
    if (hasZOffset && painter.transform.projection.name === 'globe') return;

    const crossSlope = layer.layout.get('line-cross-slope');
    const hasCrossSlope = crossSlope !== undefined;
    const crossSlopeHorizontal = crossSlope < 1.0;

    const depthMode = hasZOffset ?
        (new DepthMode(painter.depthOcclusion ? gl.GREATER : gl.LEQUAL, DepthMode.ReadOnly, painter.depthRangeFor3D)) :
        painter.depthModeForSublayer(0, DepthMode.ReadOnly);

    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);
    const isDraping = painter.terrain && painter.terrain.renderingToTexture;
    const pixelRatio = isDraping ? 1.0 : browser.devicePixelRatio;

    const dasharrayProperty = layer.paint.get('line-dasharray');

    const dasharray = dasharrayProperty.constantOr((1 as any));
    const capProperty = layer.layout.get('line-cap');

    const constantDash = dasharrayProperty.constantOr(null);

    const constantCap = capProperty.constantOr((null as any));
    const patternProperty = layer.paint.get('line-pattern');

    const image = patternProperty.constantOr((1 as any));

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

    let lineOpacityForOcclusion; // line opacity uniform gets amend by line occlusion opacity
    if (occlusionOpacity !== 0 && painter.depthOcclusion) {
        const value = layer.paint._values["line-opacity"];

        if (value && value.value && value.value.kind === "constant") {

            lineOpacityForOcclusion = value.value;
        } else {
            warnOnce(`Occlusion opacity for layer ${layer.id} is supported only when line-opacity isn't data-driven.`);
        }
    }
    if (hasZOffset) painter.forceTerrainMode = true;
    if (!hasZOffset && occlusionOpacity !== 0 && painter.terrain && !isDraping) {
        warnOnce(`Occlusion opacity for layer ${layer.id} is supported on terrain only if the layer has line-z-offset enabled.`);
        return;
    }
    // No need for tile clipping, a single pass only even for transparent lines.
    const stencilMode3D = (useStencilMaskRenderPass && hasZOffset) ? painter.stencilModeFor3D() : StencilMode.disabled;

    if (hasZOffset) {
        definesValues.push("ELEVATED");
        if (hasCrossSlope) {
            definesValues.push(crossSlopeHorizontal ? "CROSS_SLOPE_HORIZONTAL" : "CROSS_SLOPE_VERTICAL");
        }
        if (elevationFromSea) {
            definesValues.push('ELEVATION_REFERENCE_SEA');
        }
    }

    if (width.value.kind !== 'constant' && width.value.isLineProgressConstant === false) {
        definesValues.push("VARIABLE_LINE_WIDTH");
    }

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: LineBucket | null | undefined = (tile.getBucket(layer) as any);
        if (!bucket) continue;
        painter.prepareDrawTile();

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);
        const program = painter.getOrCreateProgram(programId, {config: programConfiguration, defines: definesValues, overrideFog: affectedByFog, overrideRtt: hasZOffset ? false : undefined});

        if (constantPattern && tile.imageAtlas) {
            const patternImage = ResolvedImage.from(constantPattern);
            const posTo = tile.imageAtlas.patternPositions[patternImage.getSerializedPrimary()];
            if (posTo) programConfiguration.setConstantPatternPositions(posTo);
        }

        if (!image && constantDash && constantCap && tile.lineAtlas) {
            const posTo = tile.lineAtlas.getDash(constantDash, constantCap);
            if (posTo) programConfiguration.setConstantPatternPositions(posTo);
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
        const uniformValues = image ?
            linePatternUniformValues(painter, tile, layer, matrix, pixelRatio, lineWidthScale, lineFloorWidthScale, [trimStart, trimEnd]) :
            lineUniformValues(painter, tile, layer, matrix, bucket.lineClipsArray.length, pixelRatio, lineWidthScale, lineFloorWidthScale, [trimStart, trimEnd]);

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

        if (hasZOffset && !elevationFromSea) {
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
                layer.paint, painter.transform.zoom, programConfiguration, [bucket.layoutVertexBuffer2, bucket.patternVertexBuffer, bucket.zOffsetVertexBuffer]);
            if (lineOpacityForOcclusion != null) {
                lineOpacityForOcclusion.value = lineOpacity; //restore
            }
        };

        if (useStencilMaskRenderPass && !hasZOffset) {
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
            if (useStencilMaskRenderPass && hasZOffset) {
                uniformValues['u_alpha_discard_threshold'] = 0.001; // to avoid stenciling pattern quads, only the content.
            }
            renderLine(hasZOffset ? stencilMode3D : painter.stencilModeForClipping(coord));
        }
    }

    // It is important that this precedes resetStencilClippingMasks as in gl-js we don't clear stencil for terrain.
    if (hasZOffset) painter.forceTerrainMode = false;

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
