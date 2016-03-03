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
        var elementGroups = bucket.elementGroups.collisionBox;

        if (!elementGroups) continue;
        if (!bucket.buffers) continue;
        if (elementGroups[0].vertexLength === 0) continue;

        bucket.bindBuffers('collisionBox', gl);
        bucket.setAttribPointers('collisionBox', gl, program, elementGroups[0].vertexOffset, layer);

        painter.setPosMatrix(coord.posMatrix);

        painter.enableTileClippingMask(coord);

        painter.lineWidth(1);
        gl.uniform1f(program.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
        gl.uniform1f(program.u_zoom, painter.transform.zoom * 10);
        gl.uniform1f(program.u_maxzoom, (tile.coord.z + 1) * 10);

        gl.drawArrays(
            gl.LINES,
            elementGroups[0].vertexStartIndex,
            elementGroups[0].vertexLength
        );

    }
}
