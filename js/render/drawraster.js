'use strict';

module.exports = drawRaster;

function drawRaster(gl, painter, bucket, layerStyle) {

    gl.switchShader(painter.rasterShader, painter.tile.posMatrix, painter.tile.exMatrix);

    gl.uniform1f(painter.rasterShader.u_brightness_low, layerStyle.brightness_low || 0);
    gl.uniform1f(painter.rasterShader.u_brightness_high, layerStyle.brightness_high || 1);
    gl.uniform1f(painter.rasterShader.u_saturation, layerStyle.saturation || 0);
    gl.uniform1f(painter.rasterShader.u_spin, layerStyle.spin || 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
    bucket.bind(gl);

    gl.vertexAttribPointer(
        painter.rasterShader.a_pos,
        painter.bufferProperties.backgroundItemSize, gl.SHORT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.bufferProperties.backgroundNumItems);
}
