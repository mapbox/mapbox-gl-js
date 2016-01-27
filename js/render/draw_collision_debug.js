'use strict';

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter, layer, coord, tile, source) {
    if (!tile.buffers) return;
    var elementGroups = tile.getElementGroups(layer, 'collisionBox');
    if (!elementGroups) return;

    var gl = painter.gl;
    var buffer = tile.buffers.collisionBoxVertex;
    var shader = painter.collisionBoxShader;
    var posMatrix = painter.calculatePosMatrix(coord, tile.tileExtent, source.maxzoom);

    gl.enable(gl.STENCIL_TEST);
    painter.enableTileClippingMask(coord);

    gl.switchShader(shader, posMatrix);

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
