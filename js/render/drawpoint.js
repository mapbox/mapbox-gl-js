'use strict';

module.exports = function drawPoint(gl, painter, layer, layerStyle, tile, stats, params, imageSprite, bucketInfo) {
    var imagePos = imageSprite.getPosition(layerStyle.image);
    var shader,
        begin = layer.lineVertexIndex,
        count = layer.lineVertexIndexEnd - begin;

    tile.geometry.lineVertex.bind(gl);

    if (!imagePos) {
        shader = painter.dotShader;

        gl.switchShader(shader, painter.translatedMatrix || painter.posMatrix, painter.exMatrix);

        gl.uniform4fv(shader.u_color, layerStyle.color || [0, 0, 0, 0]);
        gl.uniform1f(shader.u_size, layerStyle.radius*2.0*window.devicePixelRatio || 8.0*window.devicePixelRatio);
        gl.uniform1f(shader.u_blur, layerStyle.blur || 0.025);

        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 0, 0);

        gl.drawArrays(gl.POINTS, begin, count);
    } else {
        shader = painter.pointShader;

        gl.switchShader(shader, painter.translatedMatrix || painter.posMatrix, painter.exMatrix);
        gl.uniform1i(shader.u_invert, layerStyle.invert);
        gl.uniform2fv(shader.u_size, imagePos.size);
        gl.uniform2fv(shader.u_tl, imagePos.tl);
        gl.uniform2fv(shader.u_br, imagePos.br);
        gl.uniform4fv(shader.u_color, layerStyle.color || [0, 0, 0, 0]);

        var rotate = layerStyle.alignment === 'line';

        gl.uniformMatrix2fv(shader.u_rotationmatrix, false, rotate ? painter.rotationMatrix : painter.identityMat2);

        // if icons are drawn rotated, or of the map is rotating use linear filtering for textures
        imageSprite.bind(gl, rotate || params.rotating || params.zooming);

        // skip some line markers based on zoom level
        var stride = bucketInfo.spacing ?
                Math.max(0.125, Math.pow(2, Math.floor(Math.log(painter.tilePixelRatio) / Math.LN2))) : 1;

        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 8 / stride, 0);
        gl.vertexAttribPointer(shader.a_slope, 2, gl.BYTE, false, 8 / stride, 6);

        gl.drawArrays(gl.POINTS, begin * stride, count * stride);
    }

    stats.lines += count;
};
