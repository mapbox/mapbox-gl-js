'use strict';

var pixelsToTileUnits = require('../source/pixels_to_tile_units');
var createUniformPragmas = require('./create_uniform_pragmas');

var tileSize = 512;

module.exports = drawBackground;

function drawBackground(painter, source, layer) {
    var gl = painter.gl;
    var transform = painter.transform;
    var color = layer.paint['background-color'];
    var image = layer.paint['background-pattern'];
    var opacity = layer.paint['background-opacity'];
    var program;

    var imagePosA = image ? painter.spriteAtlas.getPosition(image.from, true) : null;
    var imagePosB = image ? painter.spriteAtlas.getPosition(image.to, true) : null;

    painter.setDepthSublayer(0);
    if (imagePosA && imagePosB) {

        if (painter.isOpaquePass) return;

        // Draw texture fill
        program = painter.useProgram('pattern');
        gl.uniform1i(program.u_image, 0);
        gl.uniform2fv(program.u_pattern_tl_a, imagePosA.tl);
        gl.uniform2fv(program.u_pattern_br_a, imagePosA.br);
        gl.uniform2fv(program.u_pattern_tl_b, imagePosB.tl);
        gl.uniform2fv(program.u_pattern_br_b, imagePosB.br);
        gl.uniform1f(program.u_opacity, opacity);

        gl.uniform1f(program.u_mix, image.t);

        gl.uniform2fv(program.u_pattern_size_a, imagePosA.size);
        gl.uniform2fv(program.u_pattern_size_b, imagePosB.size);
        gl.uniform1f(program.u_scale_a, image.fromScale);
        gl.uniform1f(program.u_scale_b, image.toScale);

        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);

        painter.tileExtentPatternVAO.bind(gl, program, painter.tileExtentBuffer);
    } else {
        // Draw filling rectangle.
        if (painter.isOpaquePass !== (color[3] === 1)) return;

        var pragmas = createUniformPragmas([
            {name: 'u_color', components: 4},
            {name: 'u_opacity', components: 1}
        ]);
        program = painter.useProgram('fill', [], pragmas, pragmas);
        gl.uniform4fv(program.u_color, color);
        gl.uniform1f(program.u_opacity, opacity);
        painter.tileExtentVAO.bind(gl, program, painter.tileExtentBuffer);
    }

    gl.disable(gl.STENCIL_TEST);

    // We need to draw the background in tiles in order to use calculatePosMatrix
    // which applies the projection matrix (transform.projMatrix). Otherwise
    // the depth and stencil buffers get into a bad state.
    // This can be refactored into a single draw call once earcut lands and
    // we don't have so much going on in the stencil buffer.
    var coords = transform.coveringTiles({ tileSize: tileSize });
    for (var c = 0; c < coords.length; c++) {
        var coord = coords[c];
        // var pixelsToTileUnitsBound = pixelsToTileUnits.bind({coord:coord, tileSize: tileSize});
        if (imagePosA && imagePosB) {
            var tile = {coord:coord, tileSize: tileSize};

            gl.uniform1f(program.u_tile_units_to_pixels, 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom));

            var tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom - tile.coord.z);

            var pixelX = tileSizeAtNearestZoom * (tile.coord.x + coord.w * Math.pow(2, tile.coord.z));
            var pixelY = tileSizeAtNearestZoom * tile.coord.y;
            // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
            gl.uniform2f(program.u_pixel_coord_upper, pixelX >> 16, pixelY >> 16);
            gl.uniform2f(program.u_pixel_coord_lower, pixelX & 0xFFFF, pixelY & 0xFFFF);
        }

        gl.uniformMatrix4fv(program.u_matrix, false, painter.transform.calculatePosMatrix(coord));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.length);
    }

    gl.stencilMask(0x00);
    gl.stencilFunc(gl.EQUAL, 0x80, 0x80);
}
