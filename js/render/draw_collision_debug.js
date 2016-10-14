'use strict';

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter, sourceCache, layer, coords) {
    const gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);
    const program = painter.useProgram('collisionBox');

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;
        const bufferGroups = bucket.bufferGroups.collisionBox;

        if (!bufferGroups || !bufferGroups.length) continue;
        const group = bufferGroups[0];
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
