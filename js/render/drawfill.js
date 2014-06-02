'use strict';

module.exports = drawFill;

function drawFill(gl, painter, bucket, layerStyle, params, imageSprite, background) {
    if (typeof layerStyle['fill-color'] !== 'object') console.warn('layer style has a color');

    var color = layerStyle['fill-color'];

    // TODO: expose this to the stylesheet.
    var evenodd = false;

    var buffer, vertex, elements;
    var begin, end;

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

            if (evenodd) {
                // When we draw an even/odd winding fill, we just invert all the bits.
                gl.stencilOp(gl.INVERT, gl.KEEP, gl.KEEP);
            } else {
                // When we do a nonzero fill, we count the number of times a pixel is
                // covered by a counterclockwise polygon, and subtract the number of
                // times it is "uncovered" by a clockwise polygon.
                gl.stencilOpSeparate(gl.FRONT, gl.INCR_WRAP, gl.KEEP, gl.KEEP);
                gl.stencilOpSeparate(gl.BACK, gl.DECR_WRAP, gl.KEEP, gl.KEEP);
            }

            // When drawing a shape, we first draw all shapes to the stencil buffer
            // and incrementing all areas where polygons are
            gl.colorMask(false, false, false, false);

            // Draw the actual triangle fan into the stencil buffer.
            gl.switchShader(painter.fillShader, painter.translatedMatrix || painter.tile.posMatrix, painter.tile.exMatrix);

            // Draw all buffers
            buffer = bucket.indices.fillBufferIndex;
            while (buffer <= bucket.indices.fillBufferIndexEnd) {
                vertex = bucket.geometry.fillBuffers[buffer].vertex;
                vertex.bind(gl);

                elements = bucket.geometry.fillBuffers[buffer].elements;
                elements.bind(gl);

                begin = buffer == bucket.indices.fillBufferIndex ? bucket.indices.fillElementsIndex : 0;
                end = buffer == bucket.indices.fillBufferIndexEnd ? bucket.indices.fillElementsIndexEnd : elements.index;

                gl.vertexAttribPointer(painter.fillShader.a_pos, vertex.itemSize / 2, gl.SHORT, false, 0, 0);
                gl.drawElements(gl.TRIANGLES, (end - begin) * 3, gl.UNSIGNED_SHORT, begin * 6);

                buffer++;
            }

            // Now that we have the stencil mask in the stencil buffer, we can start
            // writing to the color buffer.
            gl.colorMask(true, true, true, true);
        }

        // From now on, we don't want to update the stencil buffer anymore.
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.stencilMask(0x0);

        // Because we're drawing top-to-bottom, and we update the stencil mask
        // below, we have to draw the outline first (!)
        if (layerStyle['fill-antialias'] === undefined || layerStyle['fill-antialias'] === true && params.antialiasing) {
            gl.switchShader(painter.outlineShader, painter.translatedMatrix || painter.tile.posMatrix, painter.tile.exMatrix);
            gl.lineWidth(2 * window.devicePixelRatio);

            var strokeColor = layerStyle['stroke-color'];

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
            buffer = bucket.indices.fillBufferIndex;
            while (buffer <= bucket.indices.fillBufferIndexEnd) {
                vertex = bucket.geometry.fillBuffers[buffer].vertex;
                vertex.bind(gl);

                begin = buffer == bucket.indices.fillBufferIndex ? bucket.indices.fillVertexIndex : 0;
                end = buffer == bucket.indices.fillBufferIndexEnd ? bucket.indices.fillVertexIndexEnd : vertex.index;
                gl.vertexAttribPointer(painter.outlineShader.a_pos, 2, gl.SHORT, false, 0, 0);
                gl.drawArrays(gl.LINE_STRIP, begin, (end - begin));

                buffer++;
            }
        }

    }


    var imagePos = layerStyle.image && imageSprite.getPosition(layerStyle.image, true);

    if (imagePos) {
        // Draw texture fill

        var factor = 8 / Math.pow(2, painter.transform.tileZoom - params.z);
        var mix = painter.transform.zoomFraction;
        var imageSize = [imagePos.size[0] * factor, imagePos.size[1] * factor];

        var offset = [
            (params.x * 4096) % imageSize[0],
            (params.y * 4096) % imageSize[1]
        ];

        gl.switchShader(painter.patternShader, painter.tile.posMatrix, painter.tile.exMatrix);
        gl.uniform1i(painter.patternShader.u_image, 0);
        gl.uniform2fv(painter.patternShader.u_pattern_size, imageSize);
        gl.uniform2fv(painter.patternShader.u_offset, offset);
        gl.uniform2fv(painter.patternShader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(painter.patternShader.u_pattern_br, imagePos.br);
        gl.uniform4fv(painter.patternShader.u_color, color);
        gl.uniform1f(painter.patternShader.u_mix, mix);
        imageSprite.bind(gl, true);

    } else {
        // Draw filling rectangle.
        gl.switchShader(painter.fillShader, painter.tile.posMatrix, painter.tile.exMatrix);
        gl.uniform4fv(painter.fillShader.u_color, color);
    }

    if (background) {
        gl.stencilFunc(gl.EQUAL, 0x80, 0x80);

    } else {
        // Only draw regions that we marked
        gl.stencilFunc(gl.NOTEQUAL, 0x0, 0x3F);
    }

    // Draw a rectangle that covers the entire viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
    gl.vertexAttribPointer(painter.fillShader.a_pos, painter.bufferProperties.tileExtentItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.tileExtentNumItems);

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}
