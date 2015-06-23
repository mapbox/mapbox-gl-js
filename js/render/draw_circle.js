'use strict';

var browser = require('../util/browser.js');

module.exports = drawCircles;

function drawCircles(painter, layer, posMatrix, tile) {
    // short-circuit if tile is empty
    if (!tile.buffers) return;

    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    var gl = painter.gl;

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    gl.switchShader(painter.circleShader, tile.posMatrix, tile.exMatrix);

    var vertex = tile.buffers.circleVertex;
    var shader = painter.circleShader;
    var elements = tile.buffers.circleElement;

    // antialiasing factor: this is a minimum blur distance that serves as
    // a faux-antialiasing for the circle. since blur is a ratio of the circle's
    // size and the intent is to keep the blur at roughly 1px, the two
    // are inversely related.
    var antialias = 1 / browser.devicePixelRatio / layer.paint['circle-radius'];

    gl.disableVertexAttribArray(shader.a_color);
    gl.disableVertexAttribArray(shader.a_blur);
    gl.disableVertexAttribArray(shader.a_size);

    gl.vertexAttrib4fv(shader.a_color, layer.paint['circle-color']);
    gl.vertexAttrib1f(shader.a_blur, Math.max(layer.paint['circle-blur'], antialias));
    gl.vertexAttrib1f(shader.a_size, layer.paint['circle-radius']);

    for (var k = 0; k < elementGroups.groups.length; k++) {
        var group = elementGroups.groups[k];
        var offset = group.vertexStartIndex * vertex.itemSize;

        vertex.bind(gl, shader, offset);
        elements.bind(gl, shader, offset);

        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, elementGroups.itemSize, offset + 0);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * elements.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

    gl.enable(gl.STENCIL_TEST);
}
