'use strict';

var browser = require('../util/browser');
var mat2 = require('gl-matrix').mat2;
var pixelsToTileUnits = require('../source/pixels_to_tile_units');

/**
 * Draw a line. Under the hood this will read elements from
 * a tile, dash textures from a lineAtlas, and style properties from a layer.
 * @param {Object} painter
 * @param {Object} layer
 * @param {Object} posMatrix
 * @param {Tile} tile
 * @returns {undefined} draws with the painter
 * @private
 */
module.exports = function drawLine(painter, source, layer, coords) {
    if (painter.isOpaquePass) return;
    painter.setDepthSublayer(0);
    painter.depthMask(false);

    var gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    // don't draw zero-width lines
    if (layer.paint['line-width'] <= 0) return;

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    var antialiasing = 1 / browser.devicePixelRatio;

    var blur = layer.paint['line-blur'] + antialiasing;
    var color = layer.paint['line-color'];

    var tr = painter.transform;

    var antialiasingMatrix = mat2.create();
    mat2.scale(antialiasingMatrix, antialiasingMatrix, [1, Math.cos(tr._pitch)]);
    mat2.rotate(antialiasingMatrix, antialiasingMatrix, painter.transform.angle);

    // calculate how much longer the real world distance is at the top of the screen
    // than at the middle of the screen.
    var topedgelength = Math.sqrt(tr.height * tr.height / 4  * (1 + tr.altitude * tr.altitude));
    var x = tr.height / 2 * Math.tan(tr._pitch);
    var extra = (topedgelength + x) / topedgelength - 1;

    var dasharray = layer.paint['line-dasharray'];
    var image = layer.paint['line-pattern'];
    var program, posA, posB, imagePosA, imagePosB;

    if (dasharray) {
        program = painter.useProgram('linesdfpattern');

        gl.uniform1f(program.u_linewidth, layer.paint['line-width'] / 2);
        gl.uniform1f(program.u_gapwidth, layer.paint['line-gap-width'] / 2);
        gl.uniform1f(program.u_antialiasing, antialiasing / 2);
        gl.uniform1f(program.u_blur, blur);
        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_opacity, layer.paint['line-opacity']);

        posA = painter.lineAtlas.getDash(dasharray.from, layer.layout['line-cap'] === 'round');
        posB = painter.lineAtlas.getDash(dasharray.to, layer.layout['line-cap'] === 'round');

        gl.uniform1i(program.u_image, 0);
        gl.activeTexture(gl.TEXTURE0);
        painter.lineAtlas.bind(gl);

        gl.uniform1f(program.u_tex_y_a, posA.y);
        gl.uniform1f(program.u_tex_y_b, posB.y);
        gl.uniform1f(program.u_mix, dasharray.t);
        gl.uniform1f(program.u_extra, extra);
        gl.uniform1f(program.u_offset, -layer.paint['line-offset']);
        gl.uniformMatrix2fv(program.u_antialiasingmatrix, false, antialiasingMatrix);

    } else if (image) {
        imagePosA = painter.spriteAtlas.getPosition(image.from, true);
        imagePosB = painter.spriteAtlas.getPosition(image.to, true);
        if (!imagePosA || !imagePosB) return;

        program = painter.useProgram('linepattern');

        gl.uniform1i(program.u_image, 0);
        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);

        gl.uniform1f(program.u_linewidth, layer.paint['line-width'] / 2);
        gl.uniform1f(program.u_gapwidth, layer.paint['line-gap-width'] / 2);
        gl.uniform1f(program.u_antialiasing, antialiasing / 2);
        gl.uniform1f(program.u_blur, blur);
        gl.uniform2fv(program.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(program.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(program.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(program.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(program.u_fade, image.t);
        gl.uniform1f(program.u_opacity, layer.paint['line-opacity']);
        gl.uniform1f(program.u_extra, extra);
        gl.uniform1f(program.u_offset, -layer.paint['line-offset']);
        gl.uniformMatrix2fv(program.u_antialiasingmatrix, false, antialiasingMatrix);

    } else {
        program = painter.useProgram('line');

        gl.uniform1f(program.u_linewidth, layer.paint['line-width'] / 2);
        gl.uniform1f(program.u_gapwidth, layer.paint['line-gap-width'] / 2);
        gl.uniform1f(program.u_antialiasing, antialiasing / 2);
        gl.uniform1f(program.u_blur, blur);
        gl.uniform1f(program.u_extra, extra);
        gl.uniform1f(program.u_offset, -layer.paint['line-offset']);
        gl.uniformMatrix2fv(program.u_antialiasingmatrix, false, antialiasingMatrix);
        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_opacity, layer.paint['line-opacity']);
    }

    for (var k = 0; k < coords.length; k++) {
        var coord = coords[k];
        var tile = source.getTile(coord);
        var bucket = tile.getBucket(layer);
        if (!bucket) continue;
        var bufferGroups = bucket.bufferGroups.line;
        if (!bufferGroups) continue;

        painter.enableTileClippingMask(coord);

        // set uniforms that are different for each tile
        var posMatrix = painter.translatePosMatrix(coord.posMatrix, tile, layer.paint['line-translate'], layer.paint['line-translate-anchor']);
        gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);

        var ratio = 1 / pixelsToTileUnits(tile, 1, painter.transform.zoom);

        if (dasharray) {
            var widthA = posA.width * dasharray.fromScale;
            var widthB = posB.width * dasharray.toScale;
            var scaleA = [1 / pixelsToTileUnits(tile, widthA, painter.transform.tileZoom), -posA.height / 2];
            var scaleB = [1 / pixelsToTileUnits(tile, widthB, painter.transform.tileZoom), -posB.height / 2];
            var gamma = painter.lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2;
            gl.uniform1f(program.u_ratio, ratio);
            gl.uniform2fv(program.u_patternscale_a, scaleA);
            gl.uniform2fv(program.u_patternscale_b, scaleB);
            gl.uniform1f(program.u_sdfgamma, gamma);

        } else if (image) {
            gl.uniform1f(program.u_ratio, ratio);
            gl.uniform2fv(program.u_pattern_size_a, [
                pixelsToTileUnits(tile, imagePosA.size[0] * image.fromScale, painter.transform.tileZoom),
                imagePosB.size[1]
            ]);
            gl.uniform2fv(program.u_pattern_size_b, [
                pixelsToTileUnits(tile, imagePosB.size[0] * image.toScale, painter.transform.tileZoom),
                imagePosB.size[1]
            ]);

        } else {
            gl.uniform1f(program.u_ratio, ratio);
        }

        for (var i = 0; i < bufferGroups.length; i++) {
            var group = bufferGroups[i];
            group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer);
            gl.drawElements(gl.TRIANGLES, group.elementBuffer.length * 3, gl.UNSIGNED_SHORT, 0);
        }
    }

};
