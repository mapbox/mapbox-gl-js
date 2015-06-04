'use strict';

module.exports = drawCircles;

function drawCircles(painter, layer, posMatrix, tile) {
    // short-circuit if tile is empty
    if (!tile.buffers) return;

    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    var gl = painter.gl;

    gl.switchShader(painter.circleShader, tile.posMatrix);

    // gl.uniform1f(shader.u_opacity, layer.paint['icon-opacity']);
    var vertex = tile.buffers.circleVertex;
    var shader = painter.circleShader;
    var elements = tile.buffers.circleElement;

    gl.uniform4fv(shader.u_color, layer.paint['circle-color']);
    gl.uniform1f(shader.u_blur, layer.paint['circle-blur']);
    gl.uniform1f(shader.u_size, layer.paint['circle-radius']);

    var stride = 8;

    for (var k = 0; k < elementGroups.groups.length; k++) {
        var group = elementGroups.groups[k];
        var offset = group.vertexStartIndex * vertex.itemSize;

        vertex.bind(gl, shader, offset);
        elements.bind(gl, shader, offset);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * elements.itemSize;
        gl.vertexAttribPointer(painter.circleShader.a_pos, 2, gl.SHORT, false, stride, 0);
        gl.vertexAttribPointer(painter.circleShader.a_extrude, 2, gl.SHORT, false, stride, 4);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }
}
