'use strict';

var drawBackground = require('./drawbackground.js');
var browser = require('../util/browser.js');

module.exports = drawFill;

function drawFill(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, background) {

    posMatrix = painter.translateMatrix(posMatrix, layerStyle['fill-translate'], params.z);

    var color = layerStyle['fill-color'];

    var vertex, elements, group, count;

    if (!background) {
        // Draw the stencil mask.
        {
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
            gl.switchShader(painter.fillShader, posMatrix, painter.tile.exMatrix);

            // Draw all buffers
            vertex = bucket.buffers.fillVertex;
            vertex.bind(gl);
            elements = bucket.buffers.fillElement;
            elements.bind(gl);

            for (var i = 0; i < bucket.elementGroups.groups.length; i++) {
                group = bucket.elementGroups.groups[i];
                var offset = group.vertexStartIndex * vertex.itemSize;
                gl.vertexAttribPointer(painter.fillShader.a_pos, 2, gl.SHORT, false, 4, offset + 0);

                count = group.elementLength * 3;
                var elementOffset = group.elementStartIndex * elements.itemSize;
                gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
            }

            // Now that we have the stencil mask in the stencil buffer, we can start
            // writing to the color buffer.
            gl.colorMask(true, true, true, true);
        }

        // From now on, we don't want to update the stencil buffer anymore.
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.stencilMask(0x0);

        var strokeColor = layerStyle['fill-outline-color'];

        // Because we're drawing top-to-bottom, and we update the stencil mask
        // below, we have to draw the outline first (!)
        if (layerStyle['fill-antialias'] === true && params.antialiasing && !(layerStyle['fill-image'] && !strokeColor)) {
            gl.switchShader(painter.outlineShader, posMatrix, painter.tile.exMatrix);
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
            elements = bucket.buffers.fillElement;

            for (var k = 0; k < bucket.elementGroups.groups.length; k++) {
                group = bucket.elementGroups.groups[k];
                gl.vertexAttribPointer(painter.outlineShader.a_pos, 2, gl.SHORT, false, 0, 0);

                var begin = group.vertexStartIndex;
                count = group.vertexLength;
                gl.drawArrays(gl.LINE_STRIP, begin, count);
            }
        }

    }

    drawBackground(gl, painter, undefined, layerStyle, posMatrix, params, imageSprite, 'fill');
}
