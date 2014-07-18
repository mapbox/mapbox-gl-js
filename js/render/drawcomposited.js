'use strict';

module.exports = drawComposited;

function drawComposited (gl, painter, buckets, layerStyle, params, style, layer) {
    var texture = painter.namedRenderTextures[layer.id];
    if (!texture) return console.warn('missing render texture ' + layer.id);

    gl.disable(gl.STENCIL_TEST);
    gl.stencilMask(0x00);

    gl.switchShader(painter.compositeShader, painter.identityMatrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(painter.compositeShader.u_image, 0);

    gl.uniform1f(painter.compositeShader.u_opacity, layerStyle['composite-opacity']);

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.backgroundBuffer);
    gl.vertexAttribPointer(painter.compositeShader.a_pos, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.STENCIL_TEST);

    painter.freeRenderTexture(layer.id);
}
