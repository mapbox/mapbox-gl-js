'use strict';

var browser = require('../util/browser');
var mat3 = require('gl-matrix').mat3;

module.exports = drawFill;

function drawFill(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {

    var translatedPosMatrix = painter.translateMatrix(posMatrix, params.z, layerStyle['fill-translate'], layerStyle['fill-translate-anchor']);

    var color = layerStyle['fill-color'];

    var vertex, elements, group, count;

    // Draw the stencil mask.

    // We're only drawing to the first seven bits (== support a maximum of
    // 127 overlapping polygons in one place before we get rendering errors).
    gl.stencilMask(0x3F);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // Draw front facing triangles. Wherever the 0x80 bit is 1, we are
    // increasing the lower 7 bits by one if the triangle is a front-facing
    // triangle. This means that all visible polygons should be in CCW
    // orientation, while all holes (see below) are in CW orientation.
    gl.stencilFunc(gl.NOTEQUAL, 0x80, 0x80);

    // When we do a nonzero fill, we count the number of times a pixel is
    // covered by a counterclockwise polygon, and subtract the number of
    // times it is "uncovered" by a clockwise polygon.
    gl.stencilOpSeparate(gl.FRONT, gl.INCR_WRAP, gl.KEEP, gl.KEEP);
    gl.stencilOpSeparate(gl.BACK, gl.DECR_WRAP, gl.KEEP, gl.KEEP);

    // When drawing a shape, we first draw all shapes to the stencil buffer
    // and incrementing all areas where polygons are
    gl.colorMask(false, false, false, false);

    // Draw the actual triangle fan into the stencil buffer.
    gl.switchShader(painter.fillShader, translatedPosMatrix, painter.tile.exMatrix);

    // Draw all buffers
    vertex = bucket.buffers.fillVertex;
    vertex.bind(gl);
    elements = bucket.buffers.fillElement;
    elements.bind(gl);

    var offset, elementOffset;
    for (var i = 0; i < bucket.elementGroups.groups.length; i++) {
        group = bucket.elementGroups.groups[i];
        offset = group.vertexStartIndex * vertex.itemSize;
        gl.vertexAttribPointer(painter.fillShader.a_pos, 2, gl.SHORT, false, 4, offset + 0);

        count = group.elementLength * 3;
        elementOffset = group.elementStartIndex * elements.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

    // Now that we have the stencil mask in the stencil buffer, we can start
    // writing to the color buffer.
    gl.colorMask(true, true, true, true);

    // From now on, we don't want to update the stencil buffer anymore.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.stencilMask(0x0);

    var strokeColor = layerStyle['fill-outline-color'];

    // Because we're drawing top-to-bottom, and we update the stencil mask
    // below, we have to draw the outline first (!)
    if (layerStyle['fill-antialias'] === true && params.antialiasing && !(layerStyle['fill-image'] && !strokeColor)) {
        gl.switchShader(painter.outlineShader, translatedPosMatrix, painter.tile.exMatrix);
        gl.lineWidth(2 * browser.devicePixelRatio);

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

    var image = layerStyle['fill-image'];
    var opacity = layerStyle['fill-opacity'] || 1;
    var shader;

    if (image) {
        painter.spriteAtlas.setSprite(imageSprite);

        // Draw texture fill
        var imagePos = painter.spriteAtlas.getImage(image);
        if (!imagePos || imagePos.w === 0) return;

        shader = painter.patternShader;
        gl.switchShader(shader, posMatrix);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl, [
            imagePos.x / painter.spriteAtlas.width,
            imagePos.y / painter.spriteAtlas.height
        ]);
        gl.uniform2fv(shader.u_pattern_br, [
            (imagePos.x + imagePos.w) / painter.spriteAtlas.width,
            (imagePos.y + imagePos.h) / painter.spriteAtlas.height
        ]);
        gl.uniform1f(shader.u_mix, painter.transform.zoomFraction);
        gl.uniform1f(shader.u_opacity, opacity);

        var factor = 8 / Math.pow(2, painter.transform.tileZoom - params.z);

        var matrix = mat3.create();
        mat3.scale(matrix, matrix, [
            1 / (imagePos.w * factor),
            1 / (imagePos.h * factor)
        ]);

        gl.uniformMatrix3fv(shader.u_patternmatrix, false, matrix);

        painter.spriteAtlas.bind(gl, false);

    } else {
        // Draw filling rectangle.
        shader = painter.fillShader;
        gl.switchShader(shader, params.padded || posMatrix);
        gl.uniform4fv(shader.u_color, color);
    }

    // Only draw regions that we marked
    gl.stencilFunc(gl.NOTEQUAL, 0x0, 0x3F);
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
    gl.vertexAttribPointer(shader.a_pos, painter.tileExtentBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.itemCount);

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}
