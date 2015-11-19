'use strict';

var textVertices = require('../lib/debugtext');
var browser = require('../util/browser');
var TileCoord = require('../source/tile_coord');

module.exports = drawDebug;

var TilePyramid = require('../source/tile_pyramid');

var pyramid = new TilePyramid({ tileSize: 512 });

function drawDebug(painter) {
    var coords = pyramid.coveringTiles(painter.transform);
    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        drawDebugTile(painter, coord);
    }
}

function drawDebugTile(painter, coord) {
    var gl = painter.gl;

    var shader = painter.debugShader;
    gl.switchShader(shader, painter.calculateMatrix(coord, Infinity));

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
