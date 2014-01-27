'use strict';

var chroma = require('chroma-js');

module.exports = drawPoint;

function drawPoint(gl, painter, layer, layerStyle, tile, stats, params, imageSprite, bucket_info) {
    var imagePos = imageSprite.getPosition(layerStyle.image);

    if (imagePos) {
        gl.switchShader(painter.pointShader, painter.translatedMatrix || painter.posMatrix, painter.exMatrix);

        gl.uniform1i(painter.pointShader.u_invert, layerStyle.invert);
        gl.uniform2fv(painter.pointShader.u_size, imagePos.size);
        gl.uniform2fv(painter.pointShader.u_tl, imagePos.tl);
        gl.uniform2fv(painter.pointShader.u_br, imagePos.br);

        var color = (layerStyle.color || chroma([0, 0, 0, 0], 'gl')).gl();
        gl.uniform4fv(painter.pointShader.u_color, color);

        var rotate = layerStyle.alignment === 'line';
        gl.uniformMatrix2fv(painter.pointShader.u_rotationmatrix, false,
                rotate ? painter.rotationMatrix: painter.identityMat2);

        // if icons are drawn rotated, or of the map is rotating use linear filtering for textures
        var linearFilter = rotate || params.rotating || params.zooming;
        imageSprite.bind(gl, linearFilter);

        // skip some line markers based on zoom level
        var stride = bucket_info.marker ?
            Math.max(0.125, Math.pow(2, Math.floor(Math.log(painter.tilePixelRatio)/Math.LN2))) :
            1;

        var vertex = tile.geometry.lineVertex;
        vertex.bind(gl);

        gl.vertexAttribPointer(painter.pointShader.a_pos, 4, gl.SHORT, false, 8 / stride, 0);
        gl.vertexAttribPointer(painter.pointShader.a_slope, 2, gl.BYTE, false, 8 / stride, 6);

        var begin = layer.lineVertexIndex;
        var count = layer.lineVertexIndexEnd - begin;

        gl.drawArrays(gl.POINTS, begin * stride, count * stride);

        // statistics
        stats.lines += count;
    }
}
