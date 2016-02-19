'use strict';

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter, source, layer, coords) {
    var gl = painter.gl;
    var shader = painter.collisionBoxShader;
    gl.enable(gl.STENCIL_TEST);
    gl.switchShader(shader);

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];
        var tile = source.getTile(coord);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        var elementGroups = bucket.elementGroups.collisionBox;

        if (!elementGroups) continue;
        if (!bucket.buffers) continue;
        if (elementGroups[0].vertexLength === 0) continue;

        var buffer = bucket.buffers.collisionBoxVertex;
        buffer.bind(gl);
        buffer.setAttribPointers(gl, shader, 0);

        var posMatrix = painter.calculatePosMatrix(coord, source.maxzoom);
        gl.setPosMatrix(posMatrix);

        painter.enableTileClippingMask(coord);

        gl.lineWidth(1);
        gl.uniform1f(shader.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
        gl.uniform1f(shader.u_zoom, painter.transform.zoom * 10);
        gl.uniform1f(shader.u_maxzoom, (tile.coord.z + 1) * 10);

        gl.drawArrays(
            gl.LINES,
            elementGroups[0].vertexStartIndex,
            elementGroups[0].vertexLength
        );

    }
}
