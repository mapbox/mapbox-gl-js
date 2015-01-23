'use strict';

var browser = require('../util/browser');

module.exports = function drawLine(painter, layer, posMatrix, tile) {
    // No data
    if (!tile.buffers) return;
    var elementGroups = tile.elementGroups[layer.ref || layer.id];
    if (!elementGroups) return;

    var gl = painter.gl;

    // don't draw zero-width lines
    if (layer.paint['line-width'] <= 0) return;

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    var antialiasing = 1 / browser.devicePixelRatio;

    var blur = layer.paint['line-blur'] + antialiasing;
    var edgeWidth = layer.paint['line-width'] / 2;
    var inset = -1;
    var offset = 0;
    var shift = 0;

    if (layer.paint['line-gap-width'] > 0) {
        inset = layer.paint['line-gap-width'] / 2 + antialiasing * 0.5;
        edgeWidth = layer.paint['line-width'];

        // shift outer lines half a pixel towards the middle to eliminate the crack
        offset = inset - antialiasing / 2;
    }

    var outset = offset + edgeWidth + antialiasing / 2 + shift;

    var color = layer.paint['line-color'];
    var ratio = painter.transform.scale / (1 << tile.zoom) / 8;
    var vtxMatrix = painter.translateMatrix(posMatrix, tile.zoom, layer.paint['line-translate'], layer.paint['line-translate-anchor']);

    var shader;


    var dasharray = layer.paint['line-dasharray'];
    var image = layer.paint['line-image'];
    var imagePos = image && painter.spriteAtlas.getPosition(image, true);

    if (dasharray) {
        shader = painter.linesdfpatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);
        gl.uniform4fv(shader.u_color, color);

        painter.lineAtlas.bind(gl);
        var pos = painter.lineAtlas.getDash(dasharray.pattern, layer.layout['line-cap'] === 'round');

        var patternratio = Math.pow(2, Math.floor(Math.log(painter.transform.scale) / Math.LN2) - tile.zoom) / 8;
        var scale = [patternratio / pos.width / dasharray.scale, -pos.height / 2];
        var gamma = painter.lineAtlas.width / (dasharray.scale * pos.width * 256 * browser.devicePixelRatio);

        gl.uniform2fv(shader.u_patternscale, scale);
        gl.uniform1f(shader.u_tex_y, pos.y);
        gl.uniform1i(shader.u_image, 0);
        gl.uniform1f(shader.u_sdfgamma, gamma);

    } else if (imagePos) {
        var factor = 8 / Math.pow(2, painter.transform.tileZoom - tile.zoom);

        painter.spriteAtlas.bind(gl, true);

        shader = painter.linepatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        var fade;
        var duration = 300;
        var fraction = painter.transform.zoomFraction;
        var t = Math.min((Date.now() - painter.lastIntegerZoomTime) / duration, 1);

        if (painter.transform.zoom > painter.lastIntegerZoom) {
            // zooming in
            fade = fraction + (1 - fraction) * t;
            factor *= 2;
        } else {
            // zooming out
            fade = fraction - fraction * t;
        }

        gl.uniform2fv(shader.u_pattern_size, [imagePos.size[0] * factor, imagePos.size[1] ]);
        gl.uniform2fv(shader.u_pattern_tl, imagePos.tl);
        gl.uniform2fv(shader.u_pattern_br, imagePos.br);
        gl.uniform1f(shader.u_fade, fade);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);
        gl.uniform4fv(shader.u_color, color);
    }

    var vertex = tile.buffers.lineVertex;
    vertex.bind(gl);
    var element = tile.buffers.lineElement;
    element.bind(gl);

    for (var i = 0; i < elementGroups.groups.length; i++) {
        var group = elementGroups.groups[i];
        var vtxOffset = group.vertexStartIndex * vertex.itemSize;
        gl.vertexAttribPointer(shader.a_pos, 2, gl.SHORT, false, 8, vtxOffset + 0);
        gl.vertexAttribPointer(shader.a_data, 4, gl.BYTE, false, 8, vtxOffset + 4);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * element.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

};
