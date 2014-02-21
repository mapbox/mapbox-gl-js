'use strict';

module.exports = function drawLine(gl, painter, bucket, layerStyle, params, imageSprite) {
    if (typeof layerStyle.color !== 'object') console.warn('layer style has a color');

    var width = layerStyle.width;
    if (width === null) return;

    var offset = (layerStyle.offset || 0) / 2;
    var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
    var outset = offset + width / 2 + 0.5;

    var imagePos = layerStyle.image && imageSprite.getPosition(layerStyle.image);
    var shader;

    if (imagePos) {
        var factor = 8 / Math.pow(2, painter.transform.zoom - params.z);

        imageSprite.bind(gl, true);

        //factor = Math.pow(2, 4 - painter.transform.zoom + params.z);
        gl.switchShader(painter.linepatternShader, painter.translatedMatrix || painter.posMatrix, painter.exMatrix);
        shader = painter.linepatternShader;
        gl.uniform2fv(painter.linepatternShader.u_pattern_size, [imagePos.size[0] * factor, imagePos.size[1] ]);
        gl.uniform2fv(painter.linepatternShader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(painter.linepatternShader.u_pattern_br, imagePos.br);
        gl.uniform1f(painter.linepatternShader.u_fade, painter.transform.z % 1.0);

    } else {
        gl.switchShader(painter.lineShader, painter.posMatrix, painter.exMatrix);
        gl.uniform2fv(painter.lineShader.u_dasharray, layerStyle.dasharray || [1, -1]);
        shader = painter.lineShader;
    }

    gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
    gl.uniform1f(shader.u_ratio, painter.tilePixelRatio);
    gl.uniform1f(shader.u_gamma, window.devicePixelRatio);

    var color = layerStyle.color;

    if (!params.antialiasing) {
        color = color.slice();
        color[3] = Infinity;
    }
    gl.uniform4fv(shader.u_color, color);

    var vertex = bucket.geometry.lineVertex;
    vertex.bind(gl);
    gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 8, 0);
    gl.vertexAttribPointer(shader.a_extrude, 2, gl.BYTE, false, 8, 6);
    gl.vertexAttribPointer(shader.a_linesofar, 2, gl.SHORT, false, 8, 4);

    var begin = bucket.indices.lineVertexIndex;
    var count = bucket.indices.lineVertexIndexEnd - begin;

    gl.uniform1f(shader.u_point, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, begin, count);

    if (layerStyle.linejoin === 'round') {
        gl.uniform1f(shader.u_point, 1);
        gl.drawArrays(gl.POINTS, begin, count);
    }
};
