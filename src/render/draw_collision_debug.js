
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter, sourceCache, layer, coords) {
    const gl = painter.gl;
    const program = painter.useProgram('collisionBox');

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;
        const buffers = bucket.buffers.collisionBox;
        if (!buffers) continue;

        gl.uniformMatrix4fv(program.u_matrix, false, coord.posMatrix);

        painter.lineWidth(1);
        gl.uniform1f(program.u_camera_to_center_distance, painter.transform.cameraToCenterDistance);
        const pixelRatio = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const scale = Math.pow(2, painter.transform.zoom - tile.coord.z);
        gl.uniform1f(program.u_pixels_to_tile_units, pixelRatio);
        gl.uniform2f(program.u_extrude_scale,
            painter.transform.pixelsToGLUnits[0] / (pixelRatio * scale),
            painter.transform.pixelsToGLUnits[1] / (pixelRatio * scale));

        for (const segment of buffers.segments) {
            segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, null, segment.vertexOffset, null, null, buffers.collisionVertexBuffer);
            gl.drawElements(gl.LINES, segment.primitiveLength * 2, gl.UNSIGNED_SHORT, segment.primitiveOffset * 2 * 2);
        }
    }
}
