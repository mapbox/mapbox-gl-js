'use strict';

var mat4 = require('gl-matrix').mat4;
var TileCoord = require('../source/tile_coord');

module.exports = drawBackground;

function drawBackground(painter, source, layer) {
    var gl = painter.gl;
    var color = layer.paint['background-color'];
    var image = layer.paint['background-pattern'];
    var opacity = layer.paint['background-opacity'];
    var shader;

    var imagePosA = image ? painter.spriteAtlas.getPosition(image.from, true) : null;
    var imagePosB = image ? painter.spriteAtlas.getPosition(image.to, true) : null;

    painter.setSublayer(0);

    if (imagePosA && imagePosB) {

        if (painter.isOpaquePass) return;

        // Draw texture fill
        shader = painter.patternShader;
        gl.switchShader(shader);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform2fv(shader.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(shader.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(shader.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(shader.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(shader.u_opacity, opacity);
        gl.uniform1f(shader.u_mix, image.t);

        var transform = painter.transform;
        var factor = (4096 / transform.tileSize) / Math.pow(2, 0);

        gl.uniform2fv(shader.u_patternscale_a, [
            1 / (imagePosA.size[0] * factor * image.fromScale),
            1 / (imagePosA.size[1] * factor * image.fromScale)
        ]);

        gl.uniform2fv(shader.u_patternscale_b, [
            1 / (imagePosB.size[0] * factor * image.toScale),
            1 / (imagePosB.size[1] * factor * image.toScale)
        ]);

        painter.spriteAtlas.bind(gl, true);

    } else {
        // Draw filling rectangle.
        if (painter.isOpaquePass === (color[3] !== 1))) return;

        shader = painter.fillShader;
        gl.switchShader(shader);
        gl.uniform4fv(shader.u_color, color);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);

    gl.vertexAttribPointer(shader.a_pos, painter.backgroundBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.setPosMatrix(painter.identityMatrix);

    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    painter.depthMask(false);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.backgroundBuffer.itemCount);

    gl.enable(gl.STENCIL_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    painter.depthMask(true);

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);

}
