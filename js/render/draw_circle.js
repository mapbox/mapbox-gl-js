'use strict';

var browser = require('../util/browser');

module.exports = drawCircles;

function drawCircles(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;

    var gl = painter.gl;

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];

        var tile = source.getTile(coord);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        var bufferGroups = bucket.bufferGroups.circle;
        if (!bufferGroups) continue;

        var programOptions = bucket.paintAttributes.circle[layer.id];
        var program = painter.useProgram(
            'circle',
            programOptions.defines,
            programOptions.vertexPragmas,
            programOptions.fragmentPragmas
        );

        if (layer.paint['circle-pitch-scale'] === 'map') {
            gl.uniform1i(program.u_scale_with_map, true);
            gl.uniform2f(program.u_extrude_scale,
                painter.transform.pixelsToGLUnits[0] * painter.transform.altitude,
                painter.transform.pixelsToGLUnits[1] * painter.transform.altitude);
        } else {
            gl.uniform1i(program.u_scale_with_map, false);
            gl.uniform2fv(program.u_extrude_scale, painter.transform.pixelsToGLUnits);
        }

        gl.uniform1f(program.u_devicepixelratio, browser.devicePixelRatio);

        gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['circle-translate'],
            layer.paint['circle-translate-anchor']
        ));

        bucket.setUniforms(gl, 'circle', program, layer, {zoom: painter.transform.zoom});

        for (var k = 0; k < bufferGroups.length; k++) {
            var group = bufferGroups[k];
            group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer, group.paintVertexBuffers[layer.id]);
            gl.drawElements(gl.TRIANGLES, group.elementBuffer.length * 3, gl.UNSIGNED_SHORT, 0);
        }
    }
}
