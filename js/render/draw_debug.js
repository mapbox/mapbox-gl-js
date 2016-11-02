'use strict';

const textVertices = require('../lib/debugtext');
const browser = require('../util/browser');
const mat4 = require('gl-matrix').mat4;
const EXTENT = require('../data/extent');
const Buffer = require('../data/buffer');
const VertexArrayObject = require('./vertex_array_object');
const PosArray = require('../data/pos_array');

module.exports = drawDebug;

function drawDebug(painter, sourceCache, coords) {
    if (painter.isOpaquePass) return;
    if (!painter.options.debug) return;

    for (let i = 0; i < coords.length; i++) {
        drawDebugTile(painter, sourceCache, coords[i]);
    }
}

function drawDebugTile(painter, sourceCache, coord) {
    const gl = painter.gl;

    gl.disable(gl.STENCIL_TEST);
    painter.lineWidth(1 * browser.devicePixelRatio);

    const posMatrix = coord.posMatrix;
    const program = painter.useProgram('debug');

    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);
    gl.uniform4f(program.u_color, 1, 0, 0, 1);
    painter.debugVAO.bind(gl, program, painter.debugBuffer);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.debugBuffer.length);

    const vertices = textVertices(coord.toString(), 50, 200, 5);
    const debugTextArray = new PosArray();
    for (let v = 0; v < vertices.length; v += 2) {
        debugTextArray.emplaceBack(vertices[v], vertices[v + 1]);
    }
    const debugTextBuffer = Buffer.fromStructArray(debugTextArray, Buffer.BufferType.VERTEX);
    const debugTextVAO = new VertexArrayObject();
    debugTextVAO.bind(gl, program, debugTextBuffer);
    gl.uniform4f(program.u_color, 1, 1, 1, 1);

    // Draw the halo with multiple 1px lines instead of one wider line because
    // the gl spec doesn't guarantee support for lines with width > 1.
    const tileSize = sourceCache.getTile(coord).tileSize;
    const onePixel = EXTENT / (Math.pow(2, painter.transform.zoom - coord.z) * tileSize);
    const translations = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let i = 0; i < translations.length; i++) {
        const translation = translations[i];
        gl.uniformMatrix4fv(program.u_matrix, false, mat4.translate([], posMatrix, [onePixel * translation[0], onePixel * translation[1], 0]));
        gl.drawArrays(gl.LINES, 0, debugTextBuffer.length);
    }

    gl.uniform4f(program.u_color, 0, 0, 0, 1);
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);
    gl.drawArrays(gl.LINES, 0, debugTextBuffer.length);
}
