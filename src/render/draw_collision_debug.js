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
        const buffers = bucket.buffers.collisionBox;
        if (!buffers) continue;

        gl.uniformMatrix4fv(program.u_matrix, false, coord.posMatrix);

        painter.enableTileClippingMask(coord);

        painter.lineWidth(1);
        gl.uniform1f(program.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
        gl.uniform1f(program.u_zoom, painter.transform.zoom * 10);
        gl.uniform1f(program.u_maxzoom, (tile.coord.z + 1) * 10);

        gl.uniform1f(program.u_collision_y_stretch, tile.collisionTile.yStretch);
        gl.uniform1f(program.u_pitch, painter.transform.pitch / 360 * 2 * Math.PI);
        gl.uniform1f(program.u_camera_to_center_distance, painter.transform.cameraToCenterDistance);
        gl.uniform1f(program.u_minimum_pitch_scaling, tile.collisionTile.minimumPitchScaling);
        gl.uniform1f(program.u_maximum_pitch_scaling, tile.collisionTile.maximumPitchScaling);

        for (const segment of buffers.segments) {
            segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, null, segment.vertexOffset);
            gl.drawElements(gl.LINES, segment.primitiveLength * 2, gl.UNSIGNED_SHORT, segment.primitiveOffset * 2 * 2);
        }
    }
}
