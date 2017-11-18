// @flow

const mat4 = require('@mapbox/gl-matrix').mat4;
const Texture = require('./texture');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type HeatmapStyleLayer from '../style/style_layer/heatmap_style_layer';
import type HeatmapBucket from '../data/bucket/heatmap_bucket';
import type TileCoord from '../source/tile_coord';

module.exports = drawHeatmap;

function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, coords: Array<TileCoord>) {
    if (painter.isOpaquePass) return;
    if (layer.paint.get('heatmap-opacity') === 0) {
        return;
    }

    const gl = painter.gl;

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    // Allow kernels to be drawn across boundaries, so that
    // large kernels are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    renderToTexture(gl, painter, layer);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Turn on additive blending for kernels, which is a key aspect of kernel density estimation formula
    gl.blendFunc(gl.ONE, gl.ONE);

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        // Skip tiles that have uncovered parents to avoid flickering; we don't need
        // to use complex tile masking here because the change between zoom levels is subtle,
        // so it's fine to simply render the parent until all its 4 children are loaded
        if (sourceCache.hasRenderableParent(coord)) continue;

        const tile = sourceCache.getTile(coord);
        const bucket: ?HeatmapBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('heatmap', programConfiguration);
        const {zoom} = painter.transform;
        programConfiguration.setUniforms(gl, program, layer.paint, {zoom});
        gl.uniform1f(program.uniforms.u_radius, layer.paint.get('heatmap-radius'));

        gl.uniform1f(program.uniforms.u_extrude_scale, pixelsToTileUnits(tile, 1, zoom));

        gl.uniform1f(program.uniforms.u_intensity, layer.paint.get('heatmap-intensity'));
        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, coord.posMatrix);

        program.draw(
            gl,
            gl.TRIANGLES,
            layer.id,
            bucket.layoutVertexBuffer,
            bucket.indexBuffer,
            bucket.segments,
            programConfiguration);
    }

    renderTextureToMap(gl, painter, layer);
}

function renderToTexture(gl, painter, layer) {
    gl.activeTexture(gl.TEXTURE1);

    // Use a 4x downscaled screen texture for better performance
    gl.viewport(0, 0, painter.width / 4, painter.height / 4);

    let texture = layer.heatmapTexture;
    let fbo = layer.heatmapFbo;

    if (!texture) {
        texture = layer.heatmapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        fbo = layer.heatmapFbo = gl.createFramebuffer();

        bindTextureFramebuffer(gl, painter, texture, fbo);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    }
}

function bindTextureFramebuffer(gl, painter, texture, fbo) {
    // Use the higher precision half-float texture where available (producing much smoother looking heatmaps);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width / 4, painter.height / 4, 0, gl.RGBA,
        painter.extTextureHalfFloat ? painter.extTextureHalfFloat.HALF_FLOAT_OES : gl.UNSIGNED_BYTE, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // If using half-float texture as a render target is not supported, fall back to a low precision texture
    if (painter.extTextureHalfFloat && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        painter.extTextureHalfFloat = null;
        bindTextureFramebuffer(gl, painter, texture, fbo);
    }
}

function renderTextureToMap(gl, painter, layer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.activeTexture(gl.TEXTURE2);
    let colorRampTexture = layer.colorRampTexture;
    if (!colorRampTexture) {
        colorRampTexture = layer.colorRampTexture = new Texture(gl, layer.colorRamp, gl.RGBA);
    }
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const program = painter.useProgram('heatmapTexture');

    gl.viewport(0, 0, painter.width, painter.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, layer.heatmapTexture);

    const opacity = layer.paint.get('heatmap-opacity');
    gl.uniform1f(program.uniforms.u_opacity, opacity);
    gl.uniform1i(program.uniforms.u_image, 1);
    gl.uniform1i(program.uniforms.u_color_ramp, 2);

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

    gl.disable(gl.DEPTH_TEST);

    gl.uniform2f(program.uniforms.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    painter.viewportVAO.bind(gl, program, painter.viewportBuffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
}
