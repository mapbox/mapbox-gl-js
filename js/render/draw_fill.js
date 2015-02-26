'use strict';

var browser = require('../util/browser');
var mat3 = require('gl-matrix').mat3;

module.exports = drawFill;

function drawFill(painter, layer, posMatrix, tile) {
    // No data
    if (!tile.buffers) return;
    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    var gl = painter.gl;
    var translatedPosMatrix = painter.translateMatrix(posMatrix, tile, layer.paint['fill-translate'], layer.paint['fill-translate-anchor']);

    var color = layer.paint['fill-color'];

    var vertex, elements, group, count;

    // Draw all buffers
    vertex = tile.buffers.fillVertex;
    vertex.bind(gl);
    elements = tile.buffers.fillElement;
    elements.bind(gl);

    var image = layer.paint['fill-image'];
    var opacity = layer.paint['fill-opacity'] || 1;
    var shader;

    if (image) {
        // Draw texture fill
        var imagePosA = painter.spriteAtlas.getPosition(image.from, true);
        var imagePosB = painter.spriteAtlas.getPosition(image.to, true);
        if (!imagePosA || !imagePosB) return;

        shader = painter.patternShader;
        gl.switchShader(shader, posMatrix);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(shader.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(shader.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(shader.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(shader.u_opacity, opacity);
        gl.uniform1f(shader.u_mix, image.t);

        var factor = 8 / Math.pow(2, painter.transform.tileZoom - tile.zoom);

        var matrixA = mat3.create();
        mat3.scale(matrixA, matrixA, [
            1 / (imagePosA.size[0] * factor * image.fromScale),
            1 / (imagePosA.size[1] * factor * image.fromScale)
        ]);

        var matrixB = mat3.create();
        mat3.scale(matrixB, matrixB, [
            1 / (imagePosB.size[0] * factor * image.toScale),
            1 / (imagePosB.size[1] * factor * image.toScale)
        ]);

        gl.uniformMatrix3fv(shader.u_patternmatrix_a, false, matrixA);
        gl.uniformMatrix3fv(shader.u_patternmatrix_b, false, matrixB);

        painter.spriteAtlas.bind(gl, true);
    } else {
        // Draw filling rectangle.
        shader = painter.fillShader;
        gl.switchShader(shader, translatedPosMatrix);
        gl.uniform4fv(shader.u_color, color);
    }

    var offset, elementOffset;

    for (var i = 0; i < elementGroups.groups.length; i++) {
        group = elementGroups.groups[i];
        offset = group.vertexStartIndex * vertex.itemSize;
        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, 4, offset + 0);

        count = group.elementLength;
        elementOffset = group.elementStartIndex * elements.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

    var strokeColor = layer.paint['fill-outline-color'];

    // Because we're drawing top-to-bottom, we have to draw the outline first (!)
    if (layer.paint['fill-antialias'] === true && !(layer.paint['fill-image'] && !strokeColor)) {
        gl.switchShader(painter.outlineShader, translatedPosMatrix);
        gl.lineWidth(2 * browser.devicePixelRatio);

        gl.uniform2f(painter.outlineShader.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform4fv(painter.outlineShader.u_color, strokeColor ? strokeColor : color);

        // Draw all buffers
        vertex = tile.buffers.fillVertex;
        elements = tile.buffers.outlineElement;
        elements.bind(gl);

        for (var k = 0; k < elementGroups.groups.length; k++) {
            group = elementGroups.groups[k];
            offset = group.vertexStartIndex * vertex.itemSize;
            gl.vertexAttribPointer(painter.outlineShader.a_pos, 2, gl.SHORT, false, 4, offset + 0);

            count = group.secondElementLength * 2;
            elementOffset = group.secondElementStartIndex * elements.itemSize;
            gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, elementOffset);
        }
    }
}
