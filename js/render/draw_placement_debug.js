'use strict';

module.exports = drawPlacementDebug;

function drawPlacementDebug(painter, layer, posMatrix, tile) {

    var elementGroups = tile.elementGroups[layer.ref || layer.id].placementBox;
    if (!elementGroups) return;

    var gl = painter.gl;
    var buffer = tile.buffers.placementBoxVertex;
    var shader = painter.placementBoxShader;

    gl.switchShader(shader, posMatrix);
    buffer.bind(gl, shader);
    gl.lineWidth(3);

    var stride = 12;
    gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, 0);
    gl.vertexAttribPointer(shader.a_extrude, 2, gl.SHORT, false, stride, 4);
    gl.vertexAttribPointer(shader.a_data, 2, gl.BYTE, false, stride, 8);

    gl.uniform1f(shader.u_scale, Math.pow(2, painter.transform.zoom - tile.zoom));
    gl.uniform1f(shader.u_zoom, painter.transform.zoom * 10);

    var begin = elementGroups.groups[0].vertexStartIndex;
    var len = elementGroups.groups[0].vertexLength;
    gl.drawArrays(gl.LINES, begin, len);
}
