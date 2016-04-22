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
        var elementGroups = bucket.elementGroups.circle;
        if (!elementGroups) continue;

        var program = painter.useProgram('circle', bucket.getProgramMacros('circle', layer));

        gl.uniform2fv(program.u_extrude_scale, painter.transform.pixelsToGLUnits);
        gl.uniform1f(program.u_blur, layer.paint['circle-blur']);
        gl.uniform1f(program.u_devicepixelratio, browser.devicePixelRatio);
        gl.uniform1f(program.u_opacity, layer.paint['circle-opacity']);

        gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['circle-translate'],
            layer.paint['circle-translate-anchor']
        ));

        bucket.setUniforms(gl, 'circle', program, layer, {zoom: painter.transform.zoom});

        var buffers = bucket.buffers.circle;
        var vertexBuffer = buffers.layout.vertex;
        var elementBuffer = buffers.layout.element;
        var paintVertexBuffer = buffers.paint[layer.id];

        for (var k = 0; k < elementGroups.length; k++) {
            var group = elementGroups[k];
            var count = group.elementLength * 3;
            group.vaos[layer.id].bind(gl, program, vertexBuffer, paintVertexBuffer, group.vertexStartIndex, elementBuffer);
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, group.elementOffset);
        }
    }
}
