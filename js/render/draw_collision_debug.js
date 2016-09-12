'use strict';

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter, source, layer, coords) {
    var gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);
    var program = painter.useProgram('collisionbox');

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        var tile = source.getTile(coord);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        var bufferGroups = bucket.bufferGroups.collisionBox;

        if (!bufferGroups || !bufferGroups.length) continue;
        var group = bufferGroups[0];
        if (group.layoutVertexBuffer.length === 0) continue;

        gl.uniformMatrix4fv(program.u_matrix, false, coord.posMatrix);

        painter.enableTileClippingMask(coord);

        painter.lineWidth(1);
        gl.uniform1f(program.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
        gl.uniform1f(program.u_zoom, painter.transform.zoom * 10);
        gl.uniform1f(program.u_maxzoom, (tile.coord.z + 1) * 10);

        group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer);
        gl.drawArrays(gl.LINES, 0, group.layoutVertexBuffer.length);
    }
}
