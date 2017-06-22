
const browser = require('../util/browser');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = drawCircles;

function drawCircles(painter, sourceCache, layer, coords) {
    if (painter.isOpaquePass) return;

    const gl = painter.gl;

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;

        const buffers = bucket.buffers;
        const layerData = buffers.layerData[layer.id];
        const programConfiguration = layerData.programConfiguration;
        const program = painter.useProgram('circle', programConfiguration);
        programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

        gl.uniform1f(program.u_camera_to_center_distance, painter.transform.cameraToCenterDistance);
        gl.uniform1i(program.u_scale_with_map, layer.paint['circle-pitch-scale'] === 'map');
        if (layer.paint['circle-pitch-alignment'] === 'map') {
            gl.uniform1i(program.u_pitch_with_map, true);
            const pixelRatio = pixelsToTileUnits(tile, 1, painter.transform.zoom);
            gl.uniform2f(program.u_extrude_scale, pixelRatio, pixelRatio);
        } else {
            gl.uniform1i(program.u_pitch_with_map, false);
            gl.uniform2fv(program.u_extrude_scale, painter.transform.pixelsToGLUnits);
        }

        gl.uniform1f(program.u_devicepixelratio, browser.devicePixelRatio);

        gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['circle-translate'],
            layer.paint['circle-translate-anchor']
        ));

        for (const segment of buffers.segments) {
            segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, layerData.paintVertexBuffer, segment.vertexOffset);
            gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
        }
    }
}
