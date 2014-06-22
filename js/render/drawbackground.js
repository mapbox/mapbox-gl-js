'use strict';

module.exports = drawFill;

function drawFill(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, type) {

    var background;

    if (type === undefined) {
        type = 'background';
        background = true;
    }

    if (background) {
        posMatrix = painter.projectionMatrix;
    }

    var color = layerStyle[type + '-color'];
    var image = layerStyle[type + '-image'];

    var imagePos = image && imageSprite.getPosition(image, true);

    if (imagePos) {
        // Draw texture fill

        var factor = 8 / Math.pow(2, painter.transform.tileZoom - params.z);
        var mix = painter.transform.zoomFraction;
        var imageSize = [imagePos.size[0] * factor, imagePos.size[1] * factor];

        var patternOffset = [
            (params.x * 4096) % imageSize[0],
            (params.y * 4096) % imageSize[1]
        ];

        gl.switchShader(painter.patternShader, posMatrix);
        gl.uniform1i(painter.patternShader.u_image, 0);
        gl.uniform2fv(painter.patternShader.u_pattern_size, imageSize);
        gl.uniform2fv(painter.patternShader.u_offset, patternOffset);
        gl.uniform2fv(painter.patternShader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(painter.patternShader.u_pattern_br, imagePos.br);
        gl.uniform4fv(painter.patternShader.u_color, color);
        gl.uniform1f(painter.patternShader.u_mix, mix);
        imageSprite.bind(gl, true);

    } else {
        // Draw filling rectangle.
        gl.switchShader(painter.fillShader, posMatrix);
        gl.uniform4fv(painter.fillShader.u_color, color || [1.0, 0, 0, 1]);
    }

    if (background) {
        gl.disable(gl.STENCIL_TEST);
    } else {
        // Only draw regions that we marked
        gl.stencilFunc(gl.NOTEQUAL, 0x0, 0x3F);
    }

    // Draw a rectangle that covers the entire viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
    gl.vertexAttribPointer(painter.fillShader.a_pos, painter.bufferProperties.tileExtentItemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.tileExtentNumItems);

    if (background) {
        gl.enable(gl.STENCIL_TEST);
    }

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}
