'use strict';

var textVertices = require('../lib/debugtext');
var browser = require('../util/browser');

module.exports = drawDebug;

function drawDebug(painter, coords) {
    if (painter.isOpaquePass) return;
    if (!painter.options.debug) return;

    for (var i = 0; i < coords.length; i++) {
        drawDebugTile(painter, coords[i]);
    }
}

function drawDebugTile(painter, coord) {
    var gl = painter.gl;

    var shader = painter.debugShader;
    gl.switchShader(shader, painter.calculatePosMatrix(coord));

    // draw bounding rectangle
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugBuffer);
    gl.vertexAttribPointer(shader.a_pos, painter.debugBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(shader.u_color, 1, 0, 0, 1);
    gl.lineWidth(4);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.debugBuffer.itemCount);

    var vertices = textVertices(coord.toString(), 50, 200, 5);

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugTextBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(shader.a_pos, painter.debugTextBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.lineWidth(8 * browser.devicePixelRatio);
    gl.uniform4f(shader.u_color, 1, 1, 1, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.debugTextBuffer.itemSize);
    gl.lineWidth(2 * browser.devicePixelRatio);
    gl.uniform4f(shader.u_color, 0, 0, 0, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.debugTextBuffer.itemSize);
}
