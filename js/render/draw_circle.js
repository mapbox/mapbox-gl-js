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

    // antialiasing factor: this is a minimum blur distance that serves as
    // a faux-antialiasing for the circle. since blur is a ratio of the circle's
    // size and the intent is to keep the blur at roughly 1px, the two
    // are inversely related.
    var antialias = 1 / browser.devicePixelRatio / layer.paint['circle-radius'];

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];

        var tile = source.getTile(coord);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        var elementGroups = bucket.elementGroups.circle;
        if (!elementGroups) continue;

        var program = painter.useProgram('circle', bucket.getProgramMacros('circle', layer));

        gl.uniform1f(program.u_blur, Math.max(layer.paint['circle-blur'], antialias));

        painter.setPosMatrix(painter.translatePosMatrix(
            coord.posMatrix,
            tile,
            layer.paint['circle-translate'],
            layer.paint['circle-translate-anchor']
        ));
        painter.setExMatrix(painter.transform.exMatrix);

        bucket.bindBuffers('circle', gl);
        for (var k = 0; k < elementGroups.length; k++) {
            var group = elementGroups[k];
            var count = group.elementLength * 3;
            bucket.setAttribPointers('circle', gl, program, group.vertexOffset, layer, [{$zoom: painter.transform.zoom}]);
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, group.elementOffset);
        }
    }
}
