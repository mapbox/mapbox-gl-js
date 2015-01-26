'use strict';

var mat3 = require('gl-matrix').mat3;

module.exports = drawBackground;

function drawBackground(painter, layer, posMatrix) {
    var gl = painter.gl;
    var color = layer.paint['background-color'];
    var image = layer.paint['background-image'];
    var opacity = layer.paint['background-opacity'];
    var shader;

    var imagePos = image ? painter.spriteAtlas.getPosition(image, true) : null;

    if (imagePos) {
        // Draw texture fill
        shader = painter.patternShader;
        gl.switchShader(shader, posMatrix);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        gl.uniform1f(shader.u_opacity, opacity);

        var transform = painter.transform;
        var size = imagePos.size;
        var center = transform.locationCoordinate(transform.center);
        var scale = 1 / Math.pow(2, transform.zoomFraction);
        var matrix = mat3.create();

        var mix;
        var duration = 300;
        var fraction = painter.transform.zoomFraction;
        var t = Math.min((Date.now() - painter.lastIntegerZoomTime) / duration, 1);
        var factor = 1;
        if (painter.transform.zoom > painter.lastIntegerZoom) {
            // zooming in
            mix = fraction + (1 - fraction) * t;
            factor = 2;
        } else {
            // zooming out
            mix = fraction - fraction * t;
        }

        gl.uniform1f(shader.u_mix, mix);

        mat3.scale(matrix, matrix, [
            1 / (size[0] * factor),
            1 / (size[1] * factor)
        ]);
        mat3.translate(matrix, matrix, [
            (center.column * transform.tileSize) % (size[0] * factor),
            (center.row    * transform.tileSize) % (size[1] * factor)
        ]);
        mat3.rotate(matrix, matrix, -transform.angle);
        mat3.scale(matrix, matrix, [
            scale * transform.width  / 2,
           -scale * transform.height / 2
        ]);

        gl.uniformMatrix3fv(shader.u_patternmatrix, false, matrix);

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
