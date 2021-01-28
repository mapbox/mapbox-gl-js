// @flow

import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Texture from './texture.js';
import {
    lineUniformValues,
    linePatternUniformValues,
    lineSDFUniformValues,
    lineGradientUniformValues
} from './program/line_program.js';

import type Painter from './painter.js';
import type SourceCache from '../source/source_cache.js';
import type LineStyleLayer from '../style/style_layer/line_style_layer.js';
import type LineBucket from '../data/bucket/line_bucket.js';
import type {OverscaledTileID} from '../source/tile_id.js';
import {clamp, nextPowerOfTwo} from '../util/util.js';
import {renderColorRamp} from '../util/color_ramp.js';
import EXTENT from '../data/extent.js';

export default function drawLine(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('line-opacity');
    const width = layer.paint.get('line-width');
    if (opacity.constantOr(1) === 0 || width.constantOr(1) === 0) return;

    const depthMode = painter.depthModeForSublayer(0, DepthMode.ReadOnly);
    const colorMode = painter.colorModeForRenderPass();

    const dasharray = layer.paint.get('line-dasharray');
    const patternProperty = layer.paint.get('line-pattern');
    const image = patternProperty.constantOr((1: any));

    const gradient = layer.paint.get('line-gradient');
    const crossfade = layer.getCrossfadeParameters();

    const programId =
        image ? 'linePattern' :
        dasharray ? 'lineSDF' :
        gradient ? 'lineGradient' : 'line';

    const context = painter.context;
    const gl = context.gl;

    let firstTile = true;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        if (image && !tile.patternsLoaded()) continue;

        const bucket: ?LineBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        painter.prepareDrawTile(coord);

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const prevProgram = painter.context.program.get();
        const program = painter.useProgram(programId, programConfiguration);
        const programChanged = firstTile || program.program !== prevProgram;

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const posTo = atlas.patternPositions[constantPattern.to.toString()];
            const posFrom = atlas.patternPositions[constantPattern.from.toString()];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
        }

        const matrix = painter.terrain ? coord.posMatrix : null;
        const uniformValues = image ? linePatternUniformValues(painter, tile, layer, crossfade, matrix) :
            dasharray ? lineSDFUniformValues(painter, tile, layer, dasharray, crossfade, matrix) :
            gradient ? lineGradientUniformValues(painter, tile, layer, matrix, bucket.lineClipsArray.length) :
            lineUniformValues(painter, tile, layer, matrix);

        if (image) {
            context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePaintBuffers(crossfade);
        } else if (dasharray && (programChanged || painter.lineAtlas.dirty)) {
            context.activeTexture.set(gl.TEXTURE0);
            painter.lineAtlas.bind(context);
        } else if (gradient) {
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
            context.activeTexture.set(gl.TEXTURE0);
            gradientTexture.bind(layer.stepInterpolant ? gl.NEAREST : gl.LINEAR, gl.CLAMP_TO_EDGE);
        }

        program.draw(context, gl.TRIANGLES, depthMode,
            painter.stencilModeForClipping(coord), colorMode, CullFaceMode.disabled, uniformValues,
            layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer, bucket.segments,
            layer.paint, painter.transform.zoom, programConfiguration, bucket.layoutVertexBuffer2);

        firstTile = false;
        // once refactored so that bound texture state is managed, we'll also be able to remove this firstTile/programChanged logic
    }
}
