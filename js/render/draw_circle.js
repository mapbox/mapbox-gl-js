'use strict';

var browser = require('../util/browser');
var util = require('../util/util');

module.exports = drawCircles;

function drawCircles(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;

    var gl = painter.gl;

    var shader = painter.circleShader;
    painter.gl.switchShader(shader);

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

    var color = util.premultiply(layer.paint['circle-color'], layer.paint['circle-opacity']);
    gl.uniform4fv(shader.u_color, color);
    gl.uniform1f(shader.u_blur, Math.max(layer.paint['circle-blur'], antialias));
    gl.uniform1f(shader.u_size, layer.paint['circle-radius']);

    for (var i = 0; i < coords.length; i++) {
        var coord = coords[i];

        var tile = source.getTile(coord);
        if (!tile.buffers) continue;
        var elementGroups = tile.getElementGroups(layer, 'circle');
        if (!elementGroups) continue;

        var vertex = tile.buffers.circleVertex;
        var elements = tile.buffers.circleElement;

        gl.setPosMatrix(painter.translatePosMatrix(
            painter.calculatePosMatrix(coord, tile.tileExtent),
            tile,
            layer.paint['circle-translate'],
            layer.paint['circle-translate-anchor']
        ));
        gl.setExMatrix(painter.transform.exMatrix);

        for (var k = 0; k < elementGroups.groups.length; k++) {
            var group = elementGroups.groups[k];
            var offset = group.vertexStartIndex * vertex.itemSize;

            vertex.bind(gl);
            vertex.setAttribPointers(gl, shader, offset);

            elements.bind(gl);

            var count = group.elementLength * 3;
            var elementOffset = group.elementStartIndex * elements.itemSize;
            gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
        }
    }

    gl.enable(gl.STENCIL_TEST);
}
