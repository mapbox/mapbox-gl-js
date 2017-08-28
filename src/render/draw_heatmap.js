// @flow

const browser = require('../util/browser');
const EXTENT = require('../data/extent');
const mat4 = require('@mapbox/gl-matrix').mat4;
const VertexBuffer = require('../gl/vertex_buffer');
const VertexArrayObject = require('./vertex_array_object');
const PosArray = require('../data/pos_array');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type HeatmapStyleLayer from '../style/style_layer/heatmap_style_layer';
import type HeatmapBucket from '../data/bucket/heatmap_bucket';
import type TileCoord from '../source/tile_coord';

module.exports = drawHeatmap;

const defaultRampColors = {
    '0': 'rgba(20, 160, 240, 0)',
    '5': 'rgb(20, 190, 240)',
    '10': 'rgb(20, 220, 240)',
    '15': 'rgb(20, 250, 240)',
    '20': 'rgb(20, 250, 160)',
    '25': 'rgb(135, 250, 80)',
    '30': 'rgb(250, 250, 0)',
    '35': 'rgb(250, 180, 0)',
    '40': 'rgb(250, 110, 0)',
    '45': 'rgb(250, 40, 0)',
    '50': 'rgb(180, 40, 40)',
    '55': 'rgb(110, 40, 80)',
    '60': 'rgb(80, 40, 110)',
    '65': 'rgb(50, 40, 140)',
    '70': 'rgb(20, 40, 170)',
    '100': 'rgb(20, 40, 170)'
};

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
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        const tile = sourceCache.getTile(coord);
        const bucket: ?HeatmapBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const program = painter.useProgram('heatmap', programConfiguration);
        programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

        const scale = painter.transform.zoomScale(tile.coord.z - painter.transform.zoom);
        gl.uniform1f(program.uniforms.u_extrude_scale, EXTENT / tile.tileSize * scale);
        gl.uniform1f(program.uniforms.u_devicepixelratio, browser.devicePixelRatio);

        const weightScale = painter.transform.zoomScale(painter.transform.zoom - painter.transform.maxZoom);
        gl.uniform1f(program.uniforms.u_weight_scale, weightScale);
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

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const colorRampTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, colorRampTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const colorRamp = window.colorRamp = getColorRamp(defaultRampColors);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, colorRamp);

    renderTextureToMap(gl, painter, layer);

    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

function renderToTexture(gl, painter) {
    gl.activeTexture(gl.TEXTURE1);

    var ext = gl.getExtension('OES_texture_half_float');
    gl.getExtension('OES_texture_half_float_linear');

    let texture = painter.viewportTexture;
    if (!texture) {
        texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, painter.width / 4, painter.height / 4, 0, gl.RGBA, ext.HALF_FLOAT_OES, null);
        painter.viewportTexture = texture;
    } else {
        gl.bindTexture(gl.TEXTURE_2D, texture);
    }

    gl.viewport(0, 0, painter.width / 4, painter.height / 4);

    let fbo = painter.viewportFbo;
    if (!fbo) {
        fbo = painter.viewportFbo = gl.createFramebuffer();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
}

function renderTextureToMap(gl, painter, layer) {
    const program = painter.useProgram('heatmapTexture');

    gl.viewport(0, 0, painter.width, painter.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, painter.viewportTexture);

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

function getColorRamp(colors) {
    const canvas = window.document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = 256;
    canvas.height = 1;

    const gradient = ctx.createLinearGradient(1, 0, 256, 0);
    for (const stop in colors) {
        gradient.addColorStop(+stop / 100, colors[stop]);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 1);

    return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}
