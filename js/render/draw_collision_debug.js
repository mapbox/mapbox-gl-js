'use strict';

module.exports = drawPlacementDebug;

function drawPlacementDebug(painter, layer, posMatrix, tile) {

    var elementGroups = tile.elementGroups[layer.ref || layer.id].collisionBox;
    if (!elementGroups) return;

    var gl = painter.gl;
    var buffer = tile.buffers.collisionBoxVertex;
    var shader = painter.collisionBoxShader;

    gl.enable(gl.STENCIL_TEST);
    painter.setClippingMask(tile);

    gl.switchShader(shader);
    gl.uniformMatrix4fv(shader.u_matrix, false, posMatrix);
    buffer.bind(gl, shader);
    gl.lineWidth(3);

    var stride = 12;
    gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, stride, 0);
    gl.vertexAttribPointer(shader.a_extrude, 2, gl.SHORT, false, stride, 4);
    gl.vertexAttribPointer(shader.a_data, 2, gl.UNSIGNED_BYTE, false, stride, 8);

    gl.uniform1f(shader.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
    gl.uniform1f(shader.u_zoom, painter.transform.zoom * 10);
    gl.uniform1f(shader.u_maxzoom, (tile.coord.z + 1) * 10);

    var begin = elementGroups.groups[0].vertexStartIndex;
    var len = elementGroups.groups[0].vertexLength;
    gl.drawArrays(gl.LINES, begin, len);

    gl.disable(gl.STENCIL_TEST);
}
