'use strict';

var browser = require('../util/browser');

module.exports = drawCircles;

function drawCircles(painter, layer, posMatrix, tile) {
    var gl = painter.gl;

    if (!tile || !tile.buffers) return;
    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    // Blend to the front, not the back.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    var vertex = tile.buffers.circleVertex;
    var groups = elementGroups.circle.groups;

    gl.switchShader(painter.dotShader, posMatrix);

    gl.uniform1f(painter.dotShader.u_size, 4 * browser.devicePixelRatio);
    gl.uniform1f(painter.dotShader.u_blur, 0.25);
    gl.uniform4fv(painter.dotShader.u_color, [0.1, 0, 0, 0.1]);

    vertex.bind(gl, painter.dotShader, 0);
    // TODO: groups.length is 0 here.
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var begin = group.vertexStartIndex;
        var count = group.vertexLength;
        gl.vertexAttribPointer(painter.dotShader.a_pos, 2, gl.SHORT, false, 16, 0);
        gl.drawArrays(gl.POINTS, begin, count);
    }

    // Revert blending mode to blend to the back.
    gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
}
