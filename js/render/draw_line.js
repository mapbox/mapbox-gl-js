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
module.exports = function drawLine(painter, sourceCache, layer, coords) {
    if (painter.isOpaquePass) return;
    painter.setDepthSublayer(0);
    painter.depthMask(false);

    var gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    // don't draw zero-width lines
    if (layer.paint['line-width'] <= 0) return;

    var tr = painter.transform;

    for (var k = 0; k < coords.length; k++) {
        drawLineTile(painter, sourceCache, layer, coords[k]);
    }
};

function drawLineTile(painter, sourceCache, layer, coord) {
    var tile = sourceCache.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;
    var bufferGroups = bucket.bufferGroups.line;
    if (!bufferGroups) return;

    var gl = painter.gl;
    var dasharray = layer.paint['line-dasharray'];
    var image = layer.paint['line-pattern'];
    var programOptions = bucket.paintAttributes.line[layer.id];

    var program = painter.useProgram(dasharray ? 'lineSDF' : image ? 'linePattern' : 'line',
            programOptions.defines, programOptions.vertexPragmas, programOptions.fragmentPragmas);

    if (!image) {
        gl.uniform4fv(program.u_color, layer.paint['line-color']);
    }

    var posA, posB, imagePosA, imagePosB;
    if (dasharray) {
        posA = painter.lineAtlas.getDash(dasharray.from, layer.layout['line-cap'] === 'round');
        posB = painter.lineAtlas.getDash(dasharray.to, layer.layout['line-cap'] === 'round');

        gl.uniform1i(program.u_image, 0);
        gl.activeTexture(gl.TEXTURE0);
        painter.lineAtlas.bind(gl);

        gl.uniform1f(program.u_tex_y_a, posA.y);
        gl.uniform1f(program.u_tex_y_b, posB.y);
        gl.uniform1f(program.u_mix, dasharray.t);

    } else if (image) {
        imagePosA = painter.spriteAtlas.getPosition(image.from, true);
        imagePosB = painter.spriteAtlas.getPosition(image.to, true);
        if (!imagePosA || !imagePosB) return;

        gl.uniform1i(program.u_image, 0);
        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);

        gl.uniform2fv(program.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(program.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(program.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(program.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(program.u_fade, image.t);
    }

    // the distance over which the line edge fades out.
    // Retina devices need a smaller distance to avoid aliasing.
    var antialiasing = 1 / browser.devicePixelRatio;

    gl.uniform1f(program.u_linewidth, layer.paint['line-width'] / 2);
    gl.uniform1f(program.u_gapwidth, layer.paint['line-gap-width'] / 2);
    gl.uniform1f(program.u_antialiasing, antialiasing / 2);
    gl.uniform1f(program.u_blur, layer.paint['line-blur'] + antialiasing);
    gl.uniform1f(program.u_opacity, layer.paint['line-opacity']);
    gl.uniformMatrix2fv(program.u_antialiasingmatrix, false, painter.transform.lineAntialiasingMatrix);
    gl.uniform1f(program.u_offset, -layer.paint['line-offset']);
    gl.uniform1f(program.u_extra, painter.transform.lineStretch);

    painter.enableTileClippingMask(coord);

    // set uniforms that are different for each tile
    var posMatrix = painter.translatePosMatrix(coord.posMatrix, tile, layer.paint['line-translate'], layer.paint['line-translate-anchor']);
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);

    if (dasharray) {
        var widthA = posA.width * dasharray.fromScale;
        var widthB = posB.width * dasharray.toScale;
        var scaleA = [1 / pixelsToTileUnits(tile, widthA, painter.transform.tileZoom), -posA.height / 2];
        var scaleB = [1 / pixelsToTileUnits(tile, widthB, painter.transform.tileZoom), -posB.height / 2];
        var gamma = painter.lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2;

        gl.uniform2fv(program.u_patternscale_a, scaleA);
        gl.uniform2fv(program.u_patternscale_b, scaleB);
        gl.uniform1f(program.u_sdfgamma, gamma);

    } else if (image) {
        gl.uniform2fv(program.u_pattern_size_a, [
            pixelsToTileUnits(tile, imagePosA.size[0] * image.fromScale, painter.transform.tileZoom),
            imagePosB.size[1]
        ]);
        gl.uniform2fv(program.u_pattern_size_b, [
            pixelsToTileUnits(tile, imagePosB.size[0] * image.toScale, painter.transform.tileZoom),
            imagePosB.size[1]
        ]);
    }

    gl.uniform1f(program.u_ratio, 1 / pixelsToTileUnits(tile, 1, painter.transform.zoom));

    bucket.setUniforms(gl, 'line', program, layer, {zoom: painter.transform.zoom});

    for (var i = 0; i < bufferGroups.length; i++) {
        var group = bufferGroups[i];
        group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer, group.paintVertexBuffers[layer.id]);
        gl.drawElements(gl.TRIANGLES, group.elementBuffer.length * 3, gl.UNSIGNED_SHORT, 0);
    }
}
