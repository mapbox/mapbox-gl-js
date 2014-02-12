'use strict';

var mat4 = require('../lib/glmatrix.js').mat4;

module.exports = drawVertices;

function drawVertices(gl, painter, layer, layerStyle, tile) {
    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    var newPosMatrix = mat4.clone(painter.posMatrix);
    mat4.scale(newPosMatrix, newPosMatrix, [2, 2, 1]);

    gl.switchShader(painter.dotShader, newPosMatrix, painter.exMatrix);

    // // Draw debug points.
    gl.uniform1f(painter.dotShader.u_size, 4 * window.devicePixelRatio);
    gl.uniform1f(painter.dotShader.u_blur, 0.25);
    gl.uniform4fv(painter.dotShader.u_color, [0.25, 0, 0, 0.25]);

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
            gl.vertexAttribPointer(painter.dotShader.a_pos, 2, gl.SHORT, false, 0, 0);
            gl.drawArrays(gl.POINTS, begin, (end - begin));
        }
        buffer++;
    }

    gl.switchShader(painter.dotShader, painter.posMatrix, painter.exMatrix);

    // Draw line buffers
    var linesBegin = layer.lineVertexIndex;
    var linesCount = layer.lineVertexIndexEnd - linesBegin;
    if (linesCount) {
        tile.geometry.lineVertex.bind(gl);
        gl.vertexAttribPointer(painter.dotShader.a_pos, 2, gl.SHORT, false, 8, 0);
        gl.drawArrays(gl.POINTS, linesBegin, linesCount);
    }

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}
