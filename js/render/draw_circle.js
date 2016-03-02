'use strict';

var browser = require('../util/browser');

module.exports = drawCircles;

function drawCircles(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;

    var gl = painter.gl;

    var program = painter.useProgram('circle');

    painter.setDepthSublayer(0);
    painter.depthMask(false);

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    // antialiasing factor: this is a minimum blur distance that serves as
    // a faux-antialiasing for the circle. since blur is a ratio of the circle's
    // size and the intent is to keep the blur at roughly 1px, the two
    // are inversely related.
    var antialias = 1 / browser.devicePixelRatio / layer.paint['circle-radius'];

    gl.uniform1f(program.u_blur, Math.max(layer.paint['circle-blur'], antialias));
    gl.uniform1f(program.u_size, layer.paint['circle-radius']);

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];

        var tile = source.getTile(coord);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        bucket.createStyleLayer(layer);
        var elementGroups = bucket.elementGroups.circle;
        if (!elementGroups) continue;

        var vertex = bucket.buffers.circleVertex;
        var elements = bucket.buffers.circleElement;

        painter.setPosMatrix(painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['circle-translate'],
            layer.paint['circle-translate-anchor']
        ));
        painter.setExMatrix(painter.transform.exMatrix);

        for (var k = 0; k < elementGroups.length; k++) {
            var group = elementGroups[k];
            var count = group.elementLength * 3;

            vertex.bind(gl);
            elements.bind(gl);

            bucket.setAttribPointers('circle', gl, program, group.vertexOffset, [{$zoom: painter.transform.zoom}]);
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, group.elementOffset);
        }
    }

    gl.enableVertexAttribArray(program.a_color);
}
