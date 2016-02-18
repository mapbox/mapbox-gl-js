'use strict';

var textVertices = require('../lib/debugtext');
var browser = require('../util/browser');
var mat4 = require('gl-matrix').mat4;
var EXTENT = require('../data/bucket').EXTENT;

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
    gl.lineWidth(1 * browser.devicePixelRatio);

    var posMatrix = painter.calculatePosMatrix(coord, source.maxzoom);
    var shader = painter.debugShader;
    gl.switchShader(shader, posMatrix);

    // draw bounding rectangle
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugBuffer);
    gl.vertexAttribPointer(shader.a_pos, painter.debugBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(shader.u_color, 1, 0, 0, 1);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.debugBuffer.itemCount);

    var vertices = textVertices(coord.toString(), 50, 200, 5);
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugTextBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(shader.a_pos, painter.debugTextBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(shader.u_color, 1, 1, 1, 1);

    // Draw the halo with multiple 1px lines instead of one wider line because
    // the gl spec doesn't guarantee support for lines with width > 1.
    var tileSize = source.getTile(coord).tileSize;
    var onePixel = EXTENT / (Math.pow(2, painter.transform.zoom - coord.z) * tileSize);
    var translations = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (var i = 0; i < translations.length; i++) {
        var translation = translations[i];
        gl.setPosMatrix(mat4.translate([], posMatrix, [onePixel * translation[0], onePixel * translation[1], 0]));
        gl.drawArrays(gl.LINES, 0, vertices.length / painter.debugTextBuffer.itemSize);
    }

    gl.uniform4f(shader.u_color, 0, 0, 0, 1);
    gl.setPosMatrix(posMatrix);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.debugTextBuffer.itemSize);
}
