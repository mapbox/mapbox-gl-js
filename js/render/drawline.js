'use strict';

module.exports = function drawLine(gl, painter, bucket, layerStyle, params, imageSprite) {
    if (typeof layerStyle['line-color'] !== 'object') console.warn('layer style has a color');

    var width = layerStyle['line-width'];
    if (width === null) return;

    var offset = (layerStyle['line-offset'] || 0) / 2;
    var inset = Math.max(-1, offset - width / 2 - 0.5) + 1;
    var outset = offset + width / 2 + 0.5;

    var imagePos = layerStyle['line-image'] && imageSprite.getPosition(layerStyle['line-image']);
    var shader;

    if (imagePos) {
        var factor = 8 / Math.pow(2, painter.transform.tileZoom - params.z);

        imageSprite.bind(gl, true);

        //factor = Math.pow(2, 4 - painter.transform.tileZoom + params.z);
        shader = painter.linepatternShader;
        gl.switchShader(shader, painter.translatedMatrix || painter.tile.posMatrix, painter.tile.exMatrix);
        gl.uniform2fv(shader.u_pattern_size, [imagePos.size[0] * factor, imagePos.size[1] ]);
        gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        gl.uniform1f(shader.u_fade, painter.transform.zoomFraction);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, painter.tile.posMatrix, painter.tile.exMatrix);
        gl.uniform2fv(shader.u_dasharray, layerStyle['line-dasharray'] || [1, -1]);
    }

    var tilePixelRatio = painter.transform.scale / (1 << params.z) / 8;
    gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
    gl.uniform1f(shader.u_ratio, tilePixelRatio);
    gl.uniform1f(shader.u_gamma, window.devicePixelRatio);
    gl.uniform1f(shader.u_blur, layerStyle['line-blur'] === undefined ? 1 : layerStyle['line-blur']);

    var color = layerStyle['line-color'];

    if (!params.antialiasing) {
        color = color.slice();
        color[3] = Infinity;
    }
    gl.uniform4fv(shader.u_color, color);

    var buffer = bucket.indices.lineBufferIndex;
    while (buffer <= bucket.indices.lineBufferIndexEnd) {
        var vertex = bucket.geometry.lineBuffers[buffer].vertex;
        vertex.bind(gl);

        var elements = bucket.geometry.lineBuffers[buffer].element;
        elements.bind(gl);

        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 8, 0);
        gl.vertexAttribPointer(shader.a_extrude, 2, gl.BYTE, false, 8, 6);
        gl.vertexAttribPointer(shader.a_linesofar, 2, gl.SHORT, false, 8, 4);

        var begin = buffer == bucket.indices.lineBufferIndex ? bucket.indices.lineElementIndex : 0;
        var end = buffer == bucket.indices.lineBufferIndexEnd ? bucket.indices.lineElementIndexEnd : elements.index;

        gl.drawElements(gl.TRIANGLES, (end - begin)  * 3, gl.UNSIGNED_SHORT, begin * 6);

        buffer++;
    }
};
