'use strict';

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter, layer, coordID, tile) {
    if (!tile.elementGroups[layer.ref || layer.id]) return;
    var elementGroups = tile.elementGroups[layer.ref || layer.id].collisionBox;
    if (!elementGroups) return;
    if (!tile.buffers) return;

    var gl = painter.gl;
    var buffer = tile.buffers.collisionBoxVertex;
    var shader = painter.collisionBoxShader;
    var posMatrix = painter.calculatePosMatrix(coordID, Infinity);

    gl.enable(gl.STENCIL_TEST);
    painter.enableTileClippingMask(coordID);

    gl.switchShader(shader);
    gl.uniformMatrix4fv(shader.u_matrix, false, posMatrix);

    buffer.bind(gl);
    buffer.setAttribPointers(gl, shader, 0);

    gl.lineWidth(1);

    gl.uniform1f(shader.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
    gl.uniform1f(shader.u_zoom, painter.transform.zoom * 10);
    gl.uniform1f(shader.u_maxzoom, (tile.coord.z + 1) * 10);

    var begin = elementGroups.groups[0].vertexStartIndex;
    var len = elementGroups.groups[0].vertexLength;
    gl.drawArrays(gl.LINES, begin, len);

    gl.disable(gl.STENCIL_TEST);
}
