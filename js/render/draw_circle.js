'use strict';

module.exports = drawCircles;

function drawCircles(painter, layer, posMatrix, tile) {
    // short-circuit if tile is empty
    if (!tile.buffers) return;

    posMatrix = painter.translateMatrix(posMatrix, tile, layer.paint['circle-translate'], layer.paint['circle-translate-anchor']);

    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    var gl = painter.gl;

    // Allow circles to be drawn across boundaries, so that
    // large circles are not clipped to tiles
    gl.disable(gl.STENCIL_TEST);

    gl.switchShader(painter.circleShader, posMatrix, tile.exMatrix);

    var vertex = tile.buffers.circleVertex;
    var shader = painter.circleShader;
    var elements = tile.buffers.circleElement;

    var uniformValues = layer.getUniformValues('circle');

    gl.uniform4fv(shader.u_color, uniformValues.color);
    gl.uniform1f(shader.u_blur, uniformValues.blur[0]);
    gl.uniform1f(shader.u_size, uniformValues.size[0]);

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
