'use strict';

var browser = require('../util/browser');
var mat4 = require('gl-matrix').mat4;

module.exports = drawVertices;

function drawVertices(painter, layer, posMatrix, tile) {
    var gl = painter.gl;

    if (!tile || !tile.buffers) return;
    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Draw all buffers
    if (layer.type === 'fill') {
        drawPoints(tile.buffers.fillVertex, elementGroups.groups, posMatrix);
    } else if (layer.type === 'symbol') {
        drawPoints(tile.buffers.iconVertex, elementGroups.icon.groups, posMatrix);
        drawPoints(tile.buffers.glyphVertex, elementGroups.glyph.groups, posMatrix);
    } else if (layer.type === 'line') {
        var newPosMatrix = mat4.clone(posMatrix);
        mat4.scale(newPosMatrix, newPosMatrix, [0.5, 0.5, 1]);
        drawPoints(tile.buffers.lineVertex, elementGroups.groups, newPosMatrix);
    }

    function drawPoints(vertex, groups, matrix) {
        gl.switchShader(painter.dotShader, matrix);

        gl.uniform1f(painter.dotShader.u_size, 4 * browser.devicePixelRatio);
        gl.uniform1f(painter.dotShader.u_blur, 0.25);
        gl.uniform4fv(painter.dotShader.u_color, [0.1, 0, 0, 0.1]);

        vertex.bind(gl);
        for (var i = 0; i < groups.length; i++) {
            var group = groups[i];
            var begin = group.vertexStartIndex;
            var count = group.vertexLength;

            gl.vertexAttribPointer(painter.dotShader.a_pos, 2, gl.SHORT, false, vertex.itemSize, 0);

            gl.drawArrays(gl.POINTS, begin, count);
        }
    }

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}
