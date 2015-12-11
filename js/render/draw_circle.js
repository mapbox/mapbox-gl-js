'use strict';

var browser = require('../util/browser.js');

module.exports = drawCircles;

function drawCircles(painter, source, layer, coords) {
    painter.setSublayer(0);
    painter.depthMask(false);
    painter.gl.switchShader(painter.circleShader);

    for (var i = 0; i < coords.length; i++) {
        drawCirclesTile(painter, source, layer, coords[i]);
    }
}

function drawCirclesTile(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    if (!tile.buffers) return;
    if (!tile.elementGroups[layer.ref || layer.id]) return;

    var elementGroups = tile.elementGroups[layer.ref || layer.id].circle;
    var gl = painter.gl;
    var posMatrix = painter.calculateMatrix(coord, source.maxzoom);
    var shader = painter.circleShader;
    var vertex = tile.buffers.circleVertex;
    var elements = tile.buffers.circleElement;

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    var translatedPosMatrix = painter.translateMatrix(posMatrix, tile, layer.paint['circle-translate'], layer.paint['circle-translate-anchor']);
    gl.uniformMatrix4fv(shader.u_matrix, false, translatedPosMatrix);
    gl.uniformMatrix4fv(shader.u_exmatrix, false, painter.transform.exMatrix);

    // antialiasing factor: this is a minimum blur distance that serves as
    // a faux-antialiasing for the circle. since blur is a ratio of the circle's
    // size and the intent is to keep the blur at roughly 1px, the two
    // are inversely related.
    var antialias = 1 / browser.devicePixelRatio / layer.paint['circle-radius'];

    gl.uniform4fv(shader.u_color, layer.paint['circle-color']);
    gl.uniform1f(shader.u_blur, Math.max(layer.paint['circle-blur'], antialias));
    gl.uniform1f(shader.u_size, layer.paint['circle-radius']);

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

    gl.enable(gl.STENCIL_TEST);
}
