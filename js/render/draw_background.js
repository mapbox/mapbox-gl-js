'use strict';

var mat3 = require('gl-matrix').mat3;

module.exports = drawBackground;

function drawBackground(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {
    var color = layerStyle['background-color'];
    var image = layerStyle['background-image'];
    var opacity = layerStyle['background-opacity'];
    var shader;

    if (image) {
        painter.spriteAtlas.setSprite(imageSprite);
    }

    var imagePos = image ? painter.spriteAtlas.getImage(image) : null;

    if (imagePos) {
        // Draw texture fill
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

        var transform = painter.transform;
        var center = transform.locationCoordinate(transform.center);
        var scale = 1 / Math.pow(2, transform.zoomFraction);
        var matrix = mat3.create();

        mat3.scale(matrix, matrix, [
            1 / imagePos.w,
            1 / imagePos.h
        ]);
        mat3.translate(matrix, matrix, [
            (center.column * transform.tileSize) % imagePos.w,
            (center.row    * transform.tileSize) % imagePos.h
        ]);
        mat3.rotate(matrix, matrix, -transform.angle);
        mat3.scale(matrix, matrix, [
            scale * transform.width  / 2,
           -scale * transform.height / 2
        ]);

        gl.uniformMatrix3fv(shader.u_patternmatrix, false, matrix);

        painter.spriteAtlas.bind(gl, false);

    } else {
        // Draw filling rectangle.
        shader = painter.fillShader;
        gl.switchShader(shader, params.padded || posMatrix);
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
