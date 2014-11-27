'use strict';

var browser = require('../util/browser');

module.exports = function drawLine(gl, painter, bucket, layerStyle, posMatrix, params, imageSprite) {
    // don't draw zero-width lines
    if (layerStyle['line-width'] <= 0) return;

    var antialiasing = 1 / browser.devicePixelRatio;
    var width = layerStyle['line-width'];
    var offset = layerStyle['line-gap-width'] > 0 ? layerStyle['line-gap-width'] / 2 + width / 2 : 0;
    var blur = layerStyle['line-blur'] + antialiasing;

    var inset = Math.max(-1, offset - width / 2 - antialiasing / 2) + 1;
    var outset = offset + width / 2 + antialiasing / 2;

    var color = layerStyle['line-color'];
    var ratio = painter.transform.scale / (1 << params.z) / 8;
    var vtxMatrix = painter.translateMatrix(posMatrix, params.z, layerStyle['line-translate'], layerStyle['line-translate-anchor']);

    var shader;

    var image = layerStyle['line-image'];
    if (image) {
        painter.spriteAtlas.setSprite(imageSprite);
    }
    var imagePos = image && painter.spriteAtlas.getImage(image);
    if (imagePos) {
        var factor = 8 / Math.pow(2, painter.transform.tileZoom - params.z);

        painter.spriteAtlas.bind(gl, true);

        shader = painter.linepatternShader;
        gl.switchShader(shader, vtxMatrix, painter.tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        gl.uniform2fv(shader.u_pattern_size, [imagePos.w * factor, imagePos.h ]);
        gl.uniform2fv(shader.u_pattern_tl, [
            imagePos.x / painter.spriteAtlas.width,
            imagePos.y / painter.spriteAtlas.height
        ]);
        gl.uniform2fv(shader.u_pattern_br, [
            (imagePos.x + imagePos.w) / painter.spriteAtlas.width,
            (imagePos.y + imagePos.h) / painter.spriteAtlas.height
        ]);
        gl.uniform1f(shader.u_fade, painter.transform.zoomFraction);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, vtxMatrix, painter.tile.exMatrix);

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
        gl.vertexAttribPointer(shader.a_pos, 4, gl.SHORT, false, 8, vtxOffset + 0);
        gl.vertexAttribPointer(shader.a_extrude, 2, gl.BYTE, false, 8, vtxOffset + 6);
        gl.vertexAttribPointer(shader.a_linesofar, 2, gl.SHORT, false, 8, vtxOffset + 4);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * element.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

};
