'use strict';

module.exports = drawComposited;

function drawComposited (gl, painter, buckets, layerStyle, params, style, layer) {
    var texture = painter.namedRenderTextures[layer.name];
    if (!texture) return console.warn('missing render texture ' + layer.name);

    gl.switchShader(painter.compositeShader, painter.tile.posMatrix, painter.tile.exMatrix);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(painter.compositeShader.u_image, 0);

    gl.uniform1f(painter.compositeShader.u_opacity, layerStyle.opacity);

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
    gl.vertexAttribPointer(painter.compositeShader.a_pos, 2, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    painter.freeRenderTexture(name);
}
