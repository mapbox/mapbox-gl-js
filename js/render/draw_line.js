'use strict';

var browser = require('../util/browser');
var mat2 = require('gl-matrix').mat2;

/**
 * Draw a line. Under the hood this will read elements from
 * a tile, dash textures from a lineAtlas, and style properties from a layer.
 * @param {Object} painter
 * @param {Object} layer
 * @param {Object} posMatrix
 * @param {Tile} tile
 * @returns {undefined} draws with the painter
 */
module.exports = function drawLine(painter, layer, posMatrix, tile) {

    if (painter.opaquePass) return;
    painter.setSublayer(0);

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
    var ratio = painter.transform.scale / (1 << tile.coord.z) / (4096 / tile.tileSize);
    var vtxMatrix = painter.translateMatrix(posMatrix, tile, layer.paint['line-translate'], layer.paint['line-translate-anchor']);

    var tr = painter.transform;


    var antialiasingMatrix = mat2.create();
    mat2.scale(antialiasingMatrix, antialiasingMatrix, [1, Math.cos(tr._pitch)]);
    mat2.rotate(antialiasingMatrix, antialiasingMatrix, painter.transform.angle);

    // calculate how much longer the real world distance is at the top of the screen
    // than at the middle of the screen.
    var topedgelength = Math.sqrt(tr.height * tr.height / 4  * (1 + tr.altitude * tr.altitude));
    var x = tr.height / 2 * Math.tan(tr._pitch);
    var extra = (topedgelength + x) / topedgelength - 1;

    // how much the tile is overscaled by
    var overscaling = tile.tileSize / painter.transform.tileSize;

    var shader;


    var dasharray = layer.paint['line-dasharray'];
    var image = layer.paint['line-image'];

    if (dasharray) {

        shader = painter.linesdfpatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);
        gl.uniform4fv(shader.u_color, color);

        var posA = painter.lineAtlas.getDash(dasharray.from, layer.layout['line-cap'] === 'round');
        var posB = painter.lineAtlas.getDash(dasharray.to, layer.layout['line-cap'] === 'round');
        painter.lineAtlas.bind(gl);

        var patternratio = Math.pow(2, Math.floor(Math.log(painter.transform.scale) / Math.LN2) - tile.coord.z) / 8 * overscaling;
        var scaleA = [patternratio / posA.width / dasharray.fromScale, -posA.height / 2];
        var gammaA = painter.lineAtlas.width / (dasharray.fromScale * posA.width * 256 * browser.devicePixelRatio) / 2;
        var scaleB = [patternratio / posB.width / dasharray.toScale, -posB.height / 2];
        var gammaB = painter.lineAtlas.width / (dasharray.toScale * posB.width * 256 * browser.devicePixelRatio) / 2;

        gl.uniform2fv(shader.u_patternscale_a, scaleA);
        gl.uniform1f(shader.u_tex_y_a, posA.y);
        gl.uniform2fv(shader.u_patternscale_b, scaleB);
        gl.uniform1f(shader.u_tex_y_b, posB.y);

        gl.uniform1i(shader.u_image, 0);
        gl.uniform1f(shader.u_sdfgamma, Math.max(gammaA, gammaB));
        gl.uniform1f(shader.u_mix, dasharray.t);

    } else if (image) {
        var imagePosA = painter.spriteAtlas.getPosition(image.from, true);
        var imagePosB = painter.spriteAtlas.getPosition(image.to, true);
        if (!imagePosA || !imagePosB) return;
        var factor = 4096 / tile.tileSize / Math.pow(2, painter.transform.tileZoom - tile.coord.z) * overscaling;

        painter.spriteAtlas.bind(gl, true);

        shader = painter.linepatternShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);

        gl.uniform2fv(shader.u_pattern_size_a, [imagePosA.size[0] * factor * image.fromScale, imagePosB.size[1] ]);
        gl.uniform2fv(shader.u_pattern_size_b, [imagePosB.size[0] * factor * image.toScale, imagePosB.size[1] ]);
        gl.uniform2fv(shader.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(shader.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(shader.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(shader.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(shader.u_fade, image.t);
        gl.uniform1f(shader.u_opacity, layer.paint['line-opacity']);

    } else {
        shader = painter.lineShader;
        gl.switchShader(shader, vtxMatrix, tile.exMatrix);

        gl.uniform2fv(shader.u_linewidth, [ outset, inset ]);
        gl.uniform1f(shader.u_ratio, ratio);
        gl.uniform1f(shader.u_blur, blur);
        gl.uniform1f(shader.u_extra, extra);
        gl.uniformMatrix2fv(shader.u_antialiasingmatrix, false, antialiasingMatrix);

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
