'use strict';

var mat3 = require('gl-matrix').mat3;

module.exports = drawBackground;

function drawBackground(painter, layer, posMatrix) {
    var gl = painter.gl;
    var color = layer.paint['background-color'];
    var image = layer.paint['background-image'];
    var opacity = layer.paint['background-opacity'];
    var shader;

    var imagePosA = image ? painter.spriteAtlas.getPosition(image.from, true) : null;
    var imagePosB = image ? painter.spriteAtlas.getPosition(image.to, true) : null;

    if (imagePosA && imagePosB) {
        // Draw texture fill
        shader = painter.patternShader;
        gl.switchShader(shader, posMatrix);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(shader.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(shader.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(shader.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(shader.u_opacity, opacity);

        var transform = painter.transform;
        var sizeA = imagePosA.size;
        var sizeB = imagePosB.size;
        var center = transform.locationCoordinate(transform.center);
        var scale = 1 / Math.pow(2, transform.zoomFraction);

        gl.uniform1f(shader.u_mix, image.t);

        var matrixA = mat3.create();
        mat3.scale(matrixA, matrixA, [
            1 / (sizeA[0] * image.fromScale),
            1 / (sizeA[1] * image.fromScale)
        ]);
        mat3.translate(matrixA, matrixA, [
            (center.column * transform.tileSize) % (sizeA[0] * image.fromScale),
            (center.row    * transform.tileSize) % (sizeA[1] * image.fromScale)
        ]);
        mat3.rotate(matrixA, matrixA, -transform.angle);
        mat3.scale(matrixA, matrixA, [
            scale * transform.width  / 2,
           -scale * transform.height / 2
        ]);

        var matrixB = mat3.create();
        mat3.scale(matrixB, matrixB, [
            1 / (sizeB[0] * image.toScale),
            1 / (sizeB[1] * image.toScale)
        ]);
        mat3.translate(matrixB, matrixB, [
            (center.column * transform.tileSize) % (sizeB[0] * image.toScale),
            (center.row    * transform.tileSize) % (sizeB[1] * image.toScale)
        ]);
        mat3.rotate(matrixB, matrixB, -transform.angle);
        mat3.scale(matrixB, matrixB, [
            scale * transform.width  / 2,
           -scale * transform.height / 2
        ]);

        gl.uniformMatrix3fv(shader.u_patternmatrix_a, false, matrixA);
        gl.uniformMatrix3fv(shader.u_patternmatrix_b, false, matrixB);

        painter.spriteAtlas.bind(gl, true);

    } else {
        // Draw filling rectangle.
        shader = painter.fillShader;
        gl.switchShader(shader, posMatrix);
        gl.uniform4fv(shader.u_color, color);
    }

    gl.disable(gl.STENCIL_TEST);
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
    gl.vertexAttribPointer(shader.a_pos, painter.backgroundBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.backgroundBuffer.itemCount);
    gl.enable(gl.STENCIL_TEST);

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}
