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

    const programId =
        layer.paint['line-dasharray'] ? 'lineSDF' :
        layer.paint['line-pattern'] ? 'linePattern' : 'line';

    let prevTileZoom;
    let firstTile = true;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;

        const layerData = bucket.buffers.layerData[layer.id];
        const prevProgram = painter.currentProgram;
        const program = painter.useProgram(programId, layerData.programConfiguration);
        const programChanged = firstTile || program !== prevProgram;
        const tileRatioChanged = prevTileZoom !== tile.coord.z;

        if (programChanged) {
            layerData.programConfiguration.setUniforms(painter.gl, program, layer, {zoom: painter.transform.zoom});
        }
        drawLineTile(program, painter, tile, bucket.buffers, layer, coord, layerData, programChanged, tileRatioChanged);
        prevTileZoom = tile.coord.z;
        firstTile = false;
    }
};

function drawLineTile(program, painter, tile, buffers, layer, coord, layerData, programChanged, tileRatioChanged) {
    const gl = painter.gl;
    const dasharray = layer.paint['line-dasharray'];
    const image = layer.paint['line-pattern'];

    let posA, posB, imagePosA, imagePosB;

    if (programChanged || tileRatioChanged) {
        const tileRatio = 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom);

        if (dasharray) {
            posA = painter.lineAtlas.getDash(dasharray.from, layer.layout['line-cap'] === 'round');
            posB = painter.lineAtlas.getDash(dasharray.to, layer.layout['line-cap'] === 'round');

            const widthA = posA.width * dasharray.fromScale;
            const widthB = posB.width * dasharray.toScale;

            gl.uniform2f(program.u_patternscale_a, tileRatio / widthA, -posA.height / 2);
            gl.uniform2f(program.u_patternscale_b, tileRatio / widthB, -posB.height / 2);
            gl.uniform1f(program.u_sdfgamma, painter.lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2);

        } else if (image) {
            imagePosA = painter.spriteAtlas.getPosition(image.from, true);
            imagePosB = painter.spriteAtlas.getPosition(image.to, true);
            if (!imagePosA || !imagePosB) return;

            gl.uniform2f(program.u_pattern_size_a, imagePosA.size[0] * image.fromScale / tileRatio, imagePosB.size[1]);
            gl.uniform2f(program.u_pattern_size_b, imagePosB.size[0] * image.toScale / tileRatio, imagePosB.size[1]);
        }
    }

    if (programChanged) {
        if (!image) {
            gl.uniform4fv(program.u_color, layer.paint['line-color']);
        }

        if (dasharray) {
            gl.uniform1i(program.u_image, 0);
            gl.activeTexture(gl.TEXTURE0);
            painter.lineAtlas.bind(gl);

            gl.uniform1f(program.u_tex_y_a, posA.y);
            gl.uniform1f(program.u_tex_y_b, posB.y);
            gl.uniform1f(program.u_mix, dasharray.t);

        } else if (image) {
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
    }

    painter.enableTileClippingMask(coord);

    const posMatrix = painter.translatePosMatrix(coord.posMatrix, tile, layer.paint['line-translate'], layer.paint['line-translate-anchor']);
    gl.uniformMatrix4fv(program.u_matrix, false, posMatrix);

    gl.uniform1f(program.u_ratio, 1 / pixelsToTileUnits(tile, 1, painter.transform.zoom));

    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}
