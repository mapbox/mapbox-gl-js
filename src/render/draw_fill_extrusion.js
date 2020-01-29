// @flow

import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {
    fillExtrusionUniformValues,
    fillExtrusionPatternUniformValues,
    fillExtrusionTextureUniformValues
} from './program/fill_extrusion_program';
import Texture from './texture';
import Color from '../style-spec/util/color';

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillExtrusionStyleLayer from '../style/style_layer/fill_extrusion_style_layer';
import type FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import type {OverscaledTileID} from '../source/tile_id';

export default draw;

function draw(painter: Painter, source: SourceCache, layer: FillExtrusionStyleLayer, coords: Array<OverscaledTileID>) {
    const opacity = layer.paint.get('fill-extrusion-opacity');
    if (opacity === 0) {
        return;
    }
    const gl = painter.context.gl;
    if (painter.renderPass === 'offscreen') {
        setupFramebuffer(painter, layer, 'accum');
        const accumColorMode = new ColorMode([gl.ONE, gl.ONE], Color.transparent, [true, true, true, true]);
        drawExtrusionTiles(painter, source, layer, coords, DepthMode.disabled, StencilMode.disabled, accumColorMode, 'accum');
        setupFramebuffer(painter, layer, 'revealage');
        const revealageColorMode = new ColorMode([gl.ZERO, gl.ONE_MINUS_SRC_COLOR], Color.transparent, [true, true, true, true]);
        drawExtrusionTiles(painter, source, layer, coords, DepthMode.disabled, StencilMode.disabled, revealageColorMode, 'revealage');
    } else if (painter.renderPass === 'translucent') {
        const accumFbo = layer.accumFbo;
        const revealageFbo = layer.revealageFbo;
        const context = painter.context;
        if (!accumFbo || !revealageFbo) return;

        context.activeTexture.set(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, accumFbo.colorAttachment.get());
        context.activeTexture.set(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, revealageFbo.colorAttachment.get());

        const compositionColorMode = new ColorMode([gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA], Color.transparent, [true, true, true, true]);
        painter.useProgram('fillExtrusionTexture').draw(context, gl.TRIANGLES,
            DepthMode.disabled, StencilMode.disabled, compositionColorMode, CullFaceMode.disabled,
            fillExtrusionTextureUniformValues(painter, 0, 1),
            layer.id, painter.viewportBuffer, painter.quadTriangleIndexBuffer,
            painter.viewportSegments, layer.paint, painter.transform.zoom);
    }
}

function drawExtrusionTiles(painter, source, layer, coords, depthMode, stencilMode, colorMode, type) {
    const context = painter.context;
    const gl = context.gl;
    const patternProperty = layer.paint.get('fill-extrusion-pattern');
    const image = patternProperty.constantOr((1: any));
    const crossfade = layer.getCrossfadeParameters();
    const opacity = layer.paint.get('fill-extrusion-opacity');

    for (const coord of coords) {
        const tile = source.getTile(coord);
        const bucket: ?FillExtrusionBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram(type === 'accum' ? 'fillExtrusionAccum' : 'fillExtrusionRevealage', programConfiguration);

        if (image) {
            painter.context.activeTexture.set(gl.TEXTURE0);
            tile.imageAtlasTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            programConfiguration.updatePatternPaintBuffers(crossfade);
        }

        const constantPattern = patternProperty.constantOr(null);
        if (constantPattern && tile.imageAtlas) {
            const atlas = tile.imageAtlas;
            const posTo = atlas.patternPositions[constantPattern.to.toString()];
            const posFrom = atlas.patternPositions[constantPattern.from.toString()];
            if (posTo && posFrom) programConfiguration.setConstantPatternPositions(posTo, posFrom);
        }

        const matrix = painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint.get('fill-extrusion-translate'),
            layer.paint.get('fill-extrusion-translate-anchor'));

        const shouldUseVerticalGradient = layer.paint.get('fill-extrusion-vertical-gradient');
        const uniformValues = image ?
            fillExtrusionPatternUniformValues(matrix, painter, shouldUseVerticalGradient, opacity, coord, crossfade, tile) :
            fillExtrusionUniformValues(matrix, painter, shouldUseVerticalGradient, opacity);

        program.draw(context, context.gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, layer.id, bucket.layoutVertexBuffer, bucket.indexBuffer,
            bucket.segments, layer.paint, painter.transform.zoom,
            programConfiguration);
    }
}

function setupFramebuffer(painter, layer, type) {
    const gl = painter.context.gl;
    const context = painter.context;
    const fboName = `${type}Fbo`;

    if (layer[fboName] == null) {
        const highPrecision = type === 'accum';
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width, painter.height, 0, gl.RGBA,
            context.extTextureHalfFloat && highPrecision ? context.extTextureHalfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE, null);


        layer[fboName] = context.createFramebuffer(painter.width, painter.height);
        layer[fboName].colorAttachment.set(texture);
    }
    const fbo = layer[fboName];
    gl.bindTexture(gl.TEXTURE_2D, fbo.colorAttachment.get());
    context.bindFramebuffer.set(fbo.framebuffer);
    const clearColor = type === 'accum' ? Color.black : Color.red;
    context.clear({color: clearColor});

}
