'use strict';

var mat3 = require('../lib/glmatrix.js').mat3;

module.exports = drawFill;

function drawFill(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite, type) {

    var background;

    if (type === undefined) {
        type = 'background';
        background = true;
    }

    var color = layerStyle[type + '-color'];
    var image = layerStyle[type + '-image'];
    var opacity = layerStyle[type + '-opacity'] || 1;
    var shader;


    if (image) {
        // Draw texture fill
        var imagePos = imageSprite.getPosition(image, true);
        if (!imagePos) return;

        shader = painter.patternShader;
        gl.switchShader(shader, posMatrix);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        gl.uniform1f(shader.u_mix, painter.transform.zoomFraction);
        gl.uniform1f(shader.u_opacity, opacity);

        var patternMatrix = getPatternMatrix(background, painter.transform, params, imagePos, painter);
        gl.uniformMatrix3fv(shader.u_patternmatrix, false, patternMatrix);

        imageSprite.bind(gl, true);

    } else {
        // Draw filling rectangle.
        shader = painter.fillShader;
        gl.switchShader(shader, params.padded || posMatrix);
        gl.uniform4fv(shader.u_color, color || [1.0, 0, 0, 1]);
    }

    if (background) {
        gl.disable(gl.STENCIL_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, 0, 0);
    } else {
        // Only draw regions that we marked
        gl.stencilFunc(gl.NOTEQUAL, 0x0, 0x3F);
        gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
        gl.vertexAttribPointer(shader.a_pos, painter.bufferProperties.tileExtentItemSize, gl.SHORT, false, 0, 0);
    }

    // Draw a rectangle that covers the entire viewport.
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.tileExtentNumItems);

    if (background) {
        gl.enable(gl.STENCIL_TEST);
    }

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}

// return a matrix that projects the position coords to pattern pos coords
function getPatternMatrix(background, transform, params, imagePos) {
    var matrix = mat3.create();
    var size = imagePos.size;

    if (background) {
        var center = transform.locationCoordinate(transform.center);
        var offset = [
            (center.column * transform.tileSize) % size[0],
            (center.row * transform.tileSize) % size[1],
            0
        ];
        var scale = 1 / Math.pow(2, transform.zoomFraction);
        mat3.scale(matrix, matrix, [1 / size[0], 1 / size[1], 1]);
        mat3.translate(matrix, matrix, offset);
        mat3.rotate(matrix, matrix, -transform.angle);
        mat3.scale(matrix, matrix, [scale * transform.width / 2, -1 * scale * transform.height / 2, 1]);

    } else {
        var factor = 8 / Math.pow(2, transform.tileZoom - params.z);
        var imageSize = [size[0] * factor, size[1] * factor];
        mat3.scale(matrix, matrix, [1 / imageSize[0], 1 / imageSize[1], 1, 1]);

    }

    return matrix;
}
