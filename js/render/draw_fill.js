'use strict';

var browser = require('../util/browser');
var mat3 = require('gl-matrix').mat3;

module.exports = drawFill;

function drawFill(gl, painter, bucket, layerStyle, tile, posMatrix, params) {

    var translatedPosMatrix = painter.translateMatrix(posMatrix, tile.zoom, layerStyle['fill-translate'], layerStyle['fill-translate-anchor']);

    var color = layerStyle['fill-color'];
    var image = layerStyle['fill-image'];
    var opacity = layerStyle['fill-opacity'] || 1;
    var shader;

    if (image) {
        // Draw texture fill
        var imagePos = painter.spriteAtlas.getPosition(image, true);
        if (!imagePos) return;

        shader = painter.patternShader;
        gl.switchShader(shader, translatedPosMatrix);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        gl.uniform1f(shader.u_mix, painter.transform.zoomFraction);
        gl.uniform1f(shader.u_opacity, opacity);

        var factor = 8 / Math.pow(2, painter.transform.tileZoom - tile.zoom);

        var matrix = mat3.create();
        mat3.scale(matrix, matrix, [
            1 / (imagePos.size[0] * factor),
            1 / (imagePos.size[1] * factor),
            1, 1
        ]);

        gl.uniformMatrix3fv(shader.u_patternmatrix, false, matrix);

        painter.spriteAtlas.bind(gl, true);

    } else {
        // Draw filling rectangle.
        shader = painter.fillShader;
        gl.switchShader(shader, params.padded || translatedPosMatrix);
        gl.uniform4fv(shader.u_color, color);
    }

    var vertex, elements, group, count;

    //gl.switchShader(painter.fillShader, translatedPosMatrix, painter.tile.exMatrix);
    //gl.uniform4fv(painter.fillShader.u_color, color);

    vertex = bucket.buffers.fillVertex;
    vertex.bind(gl);
    elements = bucket.buffers.fillElement;
    elements.bind(gl);

    var offset, elementOffset;
    for (var i = 0; i < bucket.elementGroups.groups.length; i++) {
        group = bucket.elementGroups.groups[i];
        offset = group.vertexStartIndex * vertex.itemSize;
        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, 4, offset + 0);

        count = group.elementLength;
        elementOffset = group.elementStartIndex * elements.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
        if (i > 0) console.log(i);
    }

    var strokeColor = layerStyle['fill-outline-color'];

    // Because we're drawing top-to-bottom, and we update the stencil mask
    // below, we have to draw the outline first (!)
    if (layerStyle['fill-antialias'] === true && !(layerStyle['fill-image'] && !strokeColor)) {
        gl.switchShader(painter.outlineShader, translatedPosMatrix);
        gl.lineWidth(2 * browser.devicePixelRatio);

        /*
        if (strokeColor) {
            // If we defined a different color for the fill outline, we are
            // going to ignore the bits in 0x3F and just care about the global
            // clipping mask.
            gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
        } else {
            // Otherwise, we only want to draw the antialiased parts that are
            // *outside* the current shape. This is important in case the fill
            // or stroke color is translucent. If we wouldn't clip to outside
            // the current shape, some pixels from the outline stroke overlapped
            // the (non-antialiased) fill.
            gl.stencilFunc(gl.EQUAL, 0x80, 0xBF);
        }
        */

        gl.uniform2f(painter.outlineShader.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform4fv(painter.outlineShader.u_color, strokeColor ? strokeColor : color);

        // Draw all buffers
        vertex = bucket.buffers.fillVertex;
        elements = bucket.buffers.outlineElement;
        elements.bind(gl);

        for (var k = 0; k < bucket.elementGroups.groups.length; k++) {
            group = bucket.elementGroups.groups[k];
            offset = group.vertexStartIndex * vertex.itemSize;
            gl.vertexAttribPointer(painter.outlineShader.a_pos, 2, gl.SHORT, false, 4, offset + 0);

            count = group.secondElementLength * 2;
            elementOffset = group.secondElementStartIndex * elements.itemSize;
            gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, elementOffset);
        }
    }

}
