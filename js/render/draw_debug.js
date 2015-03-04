'use strict';

var textVertices = require('../lib/debugtext');
var browser = require('../util/browser');
var TileCoord = require('../source/tile_coord');

module.exports = drawDebug;

function drawDebug(painter, tile) {
    var gl = painter.gl;
    var pos = TileCoord.fromID(tile.id);

    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.switchShader(painter.debugShader, tile.posMatrix);

    // draw bounding rectangle
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugBuffer);
    gl.vertexAttribPointer(painter.debugShader.a_pos, painter.debugBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.uniform4f(painter.debugShader.u_color, 1, 0, 0, 1);
    gl.lineWidth(4);
    gl.drawArrays(gl.LINE_STRIP, 0, painter.debugBuffer.itemCount);

    // draw tile coordinate
    var coord = pos.z + '/' + pos.x + '/' + pos.y;

    var vertices = textVertices(coord, 50, 200, 5);

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.debugTextBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Int16Array(vertices), gl.STREAM_DRAW);
    gl.vertexAttribPointer(painter.debugShader.a_pos, painter.debugTextBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.lineWidth(8 * browser.devicePixelRatio);
    gl.uniform4f(painter.debugShader.u_color, 1, 1, 1, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.debugTextBuffer.itemSize);
    gl.lineWidth(2 * browser.devicePixelRatio);
    gl.uniform4f(painter.debugShader.u_color, 0, 0, 0, 1);
    gl.drawArrays(gl.LINES, 0, vertices.length / painter.debugTextBuffer.itemSize);

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}
