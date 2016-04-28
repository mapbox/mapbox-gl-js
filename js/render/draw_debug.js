'use strict';

var textVertices = require('../lib/debugtext');
var browser = require('../util/browser');
var mat4 = require('gl-matrix').mat4;
var EXTENT = require('../data/bucket').EXTENT;
var Buffer = require('../data/buffer');
var VertexArrayObject = require('./vertex_array_object');

module.exports = drawDebug;

function drawDebug(painter, source, coords) {
    if (painter.isOpaquePass) return;
    if (!painter.options.debug) return;

    for (var i = 0; i < coords.length; i++) {
        drawDebugTile(painter, source, coords[i]);
    }
}

function drawDebugTile(painter, source, coord) {
    var gl = painter.gl;

    gl.disable(gl.STENCIL_TEST);
    painter.lineWidth(1 * browser.devicePixelRatio);

    var posMatrix = coord.posMatrix;
    var program = painter.useProgram('debug');

    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);
    gl.uniform4f(program.u_color, 1, 0, 0, 1);
    painter.debugVAO.bind(gl, program, painter.debugBuffer);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.debugBuffer.length);

    var vertices = textVertices(coord.toString(), 50, 200, 5);
    var debugTextArray = new painter.PosArray();
    for (var v = 0; v < vertices.length; v += 2) {
        debugTextArray.emplaceBack(vertices[v], vertices[v + 1]);
    }
    var debugTextBuffer = new Buffer(debugTextArray.serialize(), painter.PosArray.serialize(), Buffer.BufferType.VERTEX);
    var debugTextVAO = new VertexArrayObject();
    debugTextVAO.bind(gl, program, debugTextBuffer);
    gl.uniform4f(program.u_color, 1, 1, 1, 1);

    // Draw the halo with multiple 1px lines instead of one wider line because
    // the gl spec doesn't guarantee support for lines with width > 1.
    var tileSize = source.getTile(coord).tileSize;
    var onePixel = EXTENT / (Math.pow(2, painter.transform.zoom - coord.z) * tileSize);
    var translations = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var i = 0; i < translations.length; i++) {
        var translation = translations[i];
        gl.uniformMatrix4fv(program.u_matrix, false, mat4.translate([], posMatrix, [onePixel * translation[0], onePixel * translation[1], 0]));
        gl.drawArrays(gl.LINES, 0, debugTextBuffer.length);
    }

    gl.uniform4f(program.u_color, 0, 0, 0, 1);
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);
    gl.drawArrays(gl.LINES, 0, debugTextBuffer.length);
}
