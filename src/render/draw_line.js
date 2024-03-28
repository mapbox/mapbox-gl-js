// @flow

import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import Texture from './texture.js';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineDefinesValues
} from './program/line_program.js';
import browser from '../util/browser.js';

import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type LineStyleLayer from '../style/style_layer/line_style_layer.js';
import type LineBucket from '../data/bucket/line_bucket.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import type {DynamicDefinesType} from './program/program_uniforms.js';
import {clamp, nextPowerOfTwo} from '../util/util.js';
import {renderColorRamp} from '../util/color_ramp.js';
import EXTENT from '../style-spec/data/extent.js';

export default function drawLine(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');
    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    const emissiveStrength = layer.paint.get('line-emissive-strength');

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForDrapableLayerRenderPass(emissiveStrength);
    const pixelRatio = (painter.terrain && painter.terrain.renderingToTexture) ? 1.0 : browser.devicePixelRatio;

    const dasharrayProperty = layer.paint.get('line-dasharray');
    const dasharray = dasharrayProperty.constantOr((1: any));
    const capProperty = layer.layout.get('line-cap');
    const patternProperty = layer.paint.get('line-pattern');
    const image = patternProperty.constantOr((1: any));
    const hasPattern = layer.paint.get('line-pattern').constantOr((1: any));
    const hasOpacity = layer.paint.get('line-opacity').constantOr(1.0) !== 1.0;
    let useStencilMaskRenderPass = (!hasPattern && hasOpacity);

    const gradient = layer.paint.get('line-gradient');

    const programId = image ? 'linePattern' : 'line';

    const context = painter.context;
    const gl = context.gl;

    const definesValues = ((lineDefinesValues(layer): any): DynamicDefinesType[]);
    if (painter.terrain && painter.terrain.clipOrMaskOverlapStencilType()) {
        useStencilMaskRenderPass = false;
    }

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: ?LineBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        painter.prepareDrawTile();

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const affectedByFog = painter.isTileAffectedByFog(coord);
        const program = painter.getOrCreateProgram(programId, {config: programConfiguration, defines: definesValues, overrideFog: affectedByFog});

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const posTo = tile.imageAtlas.patternPositions[constantPattern.toString()];
            if (posTo) programConfiguration.setConstantPatternPositions(posTo);
        }

        const constantDash = dasharrayProperty.constantOr(null);
        const constantCap = capProperty.constantOr((null: any));

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

        const matrix = painter.terrain ? coord.projMatrix : null;
        const uniformValues = image ?
            linePatternUniformValues(painter, tile, layer, matrix, pixelRatio, [trimStart, trimEnd]) :
            lineUniformValues(painter, tile, layer, matrix, bucket.lineClipsArray.length, pixelRatio, [trimStart, trimEnd]);

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
                    layerGradient.texture = new Texture(context, layerGradient.gradient, gl.RGBA);
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

        painter.uploadCommonUniforms(context, program, coord.toUnwrapped());

        const renderLine = (stencilMode: StencilMode) => {
            program.draw(painter, gl.TRIANGLES, depthMode,
                stencilMode, colorMode, CullFaceMode.disabled, uniformValues,
                layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
                layer.paint, painter.transform.zoom, programConfiguration, [bucket.layoutVertexBuffer2]);
        };

        if (useStencilMaskRenderPass) {
            const stencilId = painter.stencilModeForClipping(coord).ref;
            // When terrain is on, ensure that the stencil buffer has 0 values.
            // As stencil may be disabled when it is not in overlapping stencil
            // mode. Refer to stencilModeForRTTOverlap logic.
            if (stencilId === 0 && painter.terrain) {
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
            renderLine(painter.stencilModeForClipping(coord));
        }
    }

    // When rendering to stencil, reset the mask to make sure that the tile
    // clipping reverts the stencil mask we may have drawn in the buffer.
    // The stamp could be reverted by an extra draw call of line geometry,
    // but tile clipping drawing is usually faster to draw than lines.
    if (useStencilMaskRenderPass) {
        painter.resetStencilClippingMasks();
        if (painter.terrain) { context.clear({stencil: 0}); }
    }
}
