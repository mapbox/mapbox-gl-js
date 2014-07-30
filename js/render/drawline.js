'use strict';

var browser = require('../util/browser.js');

module.exports = function drawLine(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {

    posMatrix = painter.translateMatrix(posMatrix, params.z, layerStyle['line-translate'], layerStyle['line-translate-anchor']);

    // don't draw zero-width lines
    if (layerStyle['line-width'] <= 0) return;

    var lineOffset = layerStyle['line-offset'] / 2;
    var inset = Math.max(-1, lineOffset - layerStyle['line-width'] / 2 - 0.5) + 1;
    var outset = lineOffset + layerStyle['line-width'] / 2 + 0.5;

    var imagePos = layerStyle['line-image'] && imageSprite.getPosition(layerStyle['line-image']);
    var shader;

    var tilePixelRatio = painter.transform.scale / (1 << params.z) / 8;

    var dasharray = layerStyle['line-dasharray'];
    if (dasharray) {
        if (imagePos) return;

        //var factor = 8 / Math.pow(2, painter.transform.tileZoom - params.z);

        //imageSprite.bind(gl, true);
        var lineAtlas = painter.lineAtlas;
        var position = lineAtlas.getPosition(dasharray.array);
        lineAtlas.bind(gl);

        //var dasharrayWidth = 20 * factor;
        var dasharrayWidth = tilePixelRatio / position.width / dasharray.scale;
        var atlasY = 0;
        var dash = [dasharrayWidth, atlasY];

        shader = painter.linepatternShader;
        gl.switchShader(shader, posMatrix, painter.tile.exMatrix);
        gl.uniform2fv(shader.u_patternscale_a, dash);
        gl.uniform2fv(shader.u_patternscale_b, [dasharrayWidth * 2, 0]);
        gl.uniform1f(shader.u_tex_y_a, position.y);
        gl.uniform1f(shader.u_tex_y_b, position.y);
        //gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        //gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        //gl.uniform1f(shader.u_fade, painter.transform.zoomFraction);
        gl.uniform1f(shader.u_fade, 0);
        gl.uniform4fv(shader.u_color, layerStyle['line-color']);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, posMatrix, painter.tile.exMatrix);
        gl.uniform2fv(shader.u_dasharray, layerStyle['line-dasharray'] || [1, -1]);
        gl.uniform4fv(shader.u_color, layerStyle['line-color']);
        gl.uniform1f(shader.u_blur, layerStyle['line-blur']);
    }

    gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
    gl.uniform1f(shader.u_ratio, tilePixelRatio);
    gl.uniform1f(shader.u_gamma, browser.devicePixelRatio);


    var vertex = bucket.buffers.lineVertex;
    vertex.bind(gl);
    var element = bucket.buffers.lineElement;
    element.bind(gl);

    var groups = bucket.elementGroups.groups;
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var offset = group.vertexStartIndex * vertex.itemSize;
        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 8, offset + 0);
        gl.vertexAttribPointer(shader.a_extrude, 2, gl.BYTE, false, 8, offset + 6);
        gl.vertexAttribPointer(shader.a_linesofar, 2, gl.SHORT, false, 8, offset + 4);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * element.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

};
