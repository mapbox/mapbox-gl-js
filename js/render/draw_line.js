'use strict';

var browser = require('../util/browser');

module.exports = function drawLine(gl, painter, bucket, layerStyle, tile, posMatrix) {
    // don't draw zero-width lines
    if (layerStyle['line-width'] <= 0) return;

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    var antialiasing = 1 / browser.devicePixelRatio;

    var blur = layerStyle['line-blur'] + antialiasing;
    var edgeWidth = layerStyle['line-width'] / 2;
    var inset = -1;
    var offset = 0;
    var shift = 0;

    if (layerStyle['line-gap-width'] > 0) {
        inset = layerStyle['line-gap-width'] / 2 + antialiasing * 0.5;
        edgeWidth = layerStyle['line-width'];

        // shift outer lines half a pixel towards the middle to eliminate the crack
        offset = inset - antialiasing / 2;
    }

    var outset = offset + edgeWidth + antialiasing / 2 + shift;

    var color = layerStyle['line-color'];
    var ratio = painter.transform.scale / (1 << tile.zoom) / 8;
    var vtxMatrix = painter.translateMatrix(posMatrix, tile.zoom, layerStyle['line-translate'], layerStyle['line-translate-anchor']);

    var shader;

    var image = layerStyle['line-image'];
    var imagePos = image && painter.spriteAtlas.getPosition(image, true);
    if (imagePos) {
        var factor = 8 / Math.pow(2, painter.transform.tileZoom - tile.zoom);

        painter.spriteAtlas.bind(gl, true);

        shader = painter.linepatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        gl.uniform2fv(shader.u_pattern_size, [imagePos.size[0] * factor, imagePos.size[1] ]);
        gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        gl.uniform1f(shader.u_fade, painter.transform.zoomFraction);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        gl.uniform4fv(shader.u_color, color);
        gl.uniform2fv(shader.u_dasharray, layerStyle['line-dasharray']);
    }

    var vertex = bucket.buffers.lineVertex;
    vertex.bind(gl);
    var element = bucket.buffers.lineElement;
    element.bind(gl);

    var groups = bucket.elementGroups.groups;
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var vtxOffset = group.vertexStartIndex * vertex.itemSize;
        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, 8, vtxOffset + 0);
        gl.vertexAttribPointer(shader.a_data, 4, gl.BYTE, false, 8, vtxOffset + 4);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * element.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

};
