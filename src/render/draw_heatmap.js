// @flow

const browser = require('../util/browser');
const EXTENT = require('../data/extent');
const mat4 = require('@mapbox/gl-matrix').mat4;
const VertexBuffer = require('../gl/vertex_buffer');
const VertexArrayObject = require('./vertex_array_object');
const PosArray = require('../data/pos_array');
const Texture = require('./texture');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type HeatmapStyleLayer from '../style/style_layer/heatmap_style_layer';
import type HeatmapBucket from '../data/bucket/heatmap_bucket';
import type TileCoord from '../source/tile_coord';

module.exports = drawHeatmap;

function drawHeatmap(painter: Painter, sourceCache: SourceCache, layer: HeatmapStyleLayer, coords: Array<TileCoord>) {
    if (painter.isOpaquePass) return;

    const gl = painter.gl;

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    renderToTexture(gl, painter);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.blendFunc(gl.ONE, gl.ONE);

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        const tile = sourceCache.getTile(coord);
        const bucket: ?HeatmapBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('heatmap', programConfiguration);
        programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});
        gl.uniform1f(program.uniforms.u_radius, layer.paint['heatmap-radius']);

        const scale = painter.transform.zoomScale(tile.coord.z - painter.transform.zoom);
        gl.uniform1f(program.uniforms.u_extrude_scale, EXTENT / tile.tileSize * scale);
        gl.uniform1f(program.uniforms.u_devicepixelratio, browser.devicePixelRatio);

        gl.uniform1f(program.uniforms.u_intensity, layer.paint['heatmap-intensity']);
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

function renderToTexture(gl, painter) {
    gl.activeTexture(gl.TEXTURE1);

    const ext = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');

    gl.viewport(0, 0, painter.width / 4, painter.height / 4);

    let texture = painter.heatmapTexture;
    let fbo = painter.heatmapFbo;

    if (!texture) {
        texture = painter.heatmapTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width / 4, painter.height / 4, 0, gl.RGBA, ext.HALF_FLOAT_OES, null);

        fbo = painter.heatmapFbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    } else {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    }
}

function renderTextureToMap(gl, painter, layer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.activeTexture(gl.TEXTURE2);
    const colorRampTexture = new Texture(gl, layer.colorRamp, gl.RGBA);
    colorRampTexture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const program = painter.useProgram('heatmapTexture');

    gl.viewport(0, 0, painter.width, painter.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.heatmapTexture);

    gl.uniform1f(program.uniforms.u_opacity, layer.paint['heatmap-opacity']);
    gl.uniform1i(program.uniforms.u_image, 1);
    gl.uniform1i(program.uniforms.u_color_ramp, 2);

    const matrix = mat4.create();
    mat4.ortho(matrix, 0, painter.width, painter.height, 0, 0, 1);
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

    gl.disable(gl.DEPTH_TEST);

    gl.uniform2f(program.uniforms.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const array = new PosArray();
    array.emplaceBack(0, 0);
    array.emplaceBack(1, 0);
    array.emplaceBack(0, 1);
    array.emplaceBack(1, 1);
    const buffer = new VertexBuffer(gl, array);
    const vao = new VertexArrayObject();
    vao.bind(gl, program, buffer);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.DEPTH_TEST);
}
