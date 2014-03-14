'use strict';

module.exports = drawComposited;

function drawComposited (gl, painter, buckets, layerStyle, params, style, layers) {
    var opaque = typeof layerStyle.opacity === 'undefined' || layerStyle.opacity === 1;

    if (!opaque) {
        painter.attachRenderTexture();
    }

    // Draw layers front-to-back.
    for (var i = layers.length - 1; i >= 0; i--) {
        painter.applyStyle(layers[i], style, buckets, params);
    }

    if (!opaque) {
        var texture = painter.getRenderTexture();
        painter.detachRenderTexture();

        gl.switchShader(painter.compositeShader, painter.tile.posMatrix, painter.tile.exMatrix);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(painter.compositeShader.u_image, 0);

        gl.uniform1f(painter.compositeShader.u_opacity, layerStyle.opacity);

        gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
        gl.vertexAttribPointer(painter.compositeShader.a_pos, 2, gl.SHORT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}
