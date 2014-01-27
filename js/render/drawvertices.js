'use strict';

var glmatrix = require('../lib/glmatrix.js');

module.exports = drawVertices;

function drawVertices(gl, painter, layer, layerStyle, tile, stats, params) {
    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // gl.switchShader(painter.areaShader, painter.posMatrix, painter.exMatrix);
    gl.switchShader(painter.debugPointShader, painter.posMatrix, painter.exMatrix);

    // // Draw debug points.
    gl.uniform1f(painter.debugPointShader.u_pointsize, 3);
    gl.uniform4fv(painter.debugPointShader.u_color, [0.25, 0, 0, 0.25]);

    // Draw the actual triangle fan into the stencil buffer.

    // Draw all buffers
    var buffer = layer.fillBufferIndex;
    while (buffer <= layer.fillBufferIndexEnd) {
        var vertex = tile.geometry.fillBuffers[buffer].vertex;
        var begin = buffer == layer.fillBufferIndex ? layer.fillVertexIndex : 0;
        var end = buffer == layer.fillBufferIndexEnd ? layer.fillVertexIndexEnd : vertex.index;
        var count = end - begin;
        if (count) {
            vertex.bind(gl);
            gl.vertexAttribPointer(painter.debugPointShader.a_pos, 2, gl.SHORT, false, 0, 0);
            gl.uniform1f(painter.debugPointShader.u_scale, 1);
            gl.drawArrays(gl.POINTS, begin, (end - begin));
        }
        buffer++;
    }


    // Draw line buffers
    var linesBegin = layer.lineVertexIndex;
    var linesCount = layer.lineVertexIndexEnd - linesBegin;
    if (linesCount) {
        tile.geometry.lineVertex.bind(gl);
        gl.vertexAttribPointer(painter.debugPointShader.a_pos, 2, gl.SHORT, false, 8, 0);
        gl.uniform1f(painter.debugPointShader.u_scale, 2);
        gl.drawArrays(gl.POINTS, linesBegin, linesCount);
    }

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}
