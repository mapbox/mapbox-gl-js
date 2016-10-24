'use strict';

const browser = require('../util/browser');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

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

    const gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    // don't draw zero-width lines
    if (layer.paint['line-width'] <= 0) return;

    for (let k = 0; k < coords.length; k++) {
        drawLineTile(painter, sourceCache, layer, coords[k]);
    }
};

function drawLineTile(painter, sourceCache, layer, coord) {
    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) return;

    const buffers = bucket.bufferGroups.line;
    const layerData = buffers.layerData[layer.id];
    const gl = painter.gl;

    const dasharray = layer.paint['line-dasharray'];
    const image = layer.paint['line-pattern'];

    const programConfiguration = layerData.programConfiguration;
    const program = painter.useProgram(dasharray ? 'lineSDF' : image ? 'linePattern' : 'line', programConfiguration);
    programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

    if (!image) {
        gl.uniform4fv(program.u_color, layer.paint['line-color']);
    }

    let posA, posB, imagePosA, imagePosB;
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
    const antialiasing = 1 / browser.devicePixelRatio;

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
    const posMatrix = painter.translatePosMatrix(coord.posMatrix, tile, layer.paint['line-translate'], layer.paint['line-translate-anchor']);
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);

    if (dasharray) {
        const widthA = posA.width * dasharray.fromScale;
        const widthB = posB.width * dasharray.toScale;
        const scaleA = [1 / pixelsToTileUnits(tile, widthA, painter.transform.tileZoom), -posA.height / 2];
        const scaleB = [1 / pixelsToTileUnits(tile, widthB, painter.transform.tileZoom), -posB.height / 2];
        const gamma = painter.lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2;

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

    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}
