'use strict';

var pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = draw;

function draw(painter, source, layer, coords) {
    var gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    var isOpaque;
    if (layer.paint['fill-pattern']) {
        isOpaque = false;
    } else {
        isOpaque = (
            layer.isPaintValueFeatureConstant('fill-color') &&
            layer.isPaintValueFeatureConstant('fill-opacity') &&
            layer.paint['fill-color'][3] === 1 &&
            layer.paint['fill-opacity'] === 1
        );
    }

    // Draw fill
    if (painter.isOpaquePass === isOpaque) {
        // Once we switch to earcut drawing we can pull most of the WebGL setup
        // outside of this coords loop.
        painter.setDepthSublayer(1);
        for (var i = 0; i < coords.length; i++) {
            drawFill(painter, source, layer, coords[i]);
        }
    }

    if (!painter.isOpaquePass && layer.paint['fill-antialias']) {
        painter.lineWidth(2);
        painter.depthMask(false);

        var isOutlineColorDefined = layer.getPaintProperty('fill-outline-color');
        if (isOutlineColorDefined || !layer.paint['fill-pattern']) {
            if (isOutlineColorDefined) {
                // If we defined a different color for the fill outline, we are
                // going to ignore the bits in 0x07 and just care about the global
                // clipping mask.
                painter.setDepthSublayer(2);
            } else {
                // Otherwise, we only want to drawFill the antialiased parts that are
                // *outside* the current shape. This is important in case the fill
                // or stroke color is translucent. If we wouldn't clip to outside
                // the current shape, some pixels from the outline stroke overlapped
                // the (non-antialiased) fill.
                painter.setDepthSublayer(0);
            }
        } else {
            // Otherwise, we only want to drawFill the antialiased parts that are
            // *outside* the current shape. This is important in case the fill
            // or stroke color is translucent. If we wouldn't clip to outside
            // the current shape, some pixels from the outline stroke overlapped
            // the (non-antialiased) fill.
            painter.setDepthSublayer(0);
        }

        for (var j = 0; j < coords.length; j++) {
            drawStroke(painter, source, layer, coords[j]);
        }
    }
}

function drawFill(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;
    var bufferGroups = bucket.bufferGroups.fill;
    if (!bufferGroups) return;

    var gl = painter.gl;

    var image = layer.paint['fill-pattern'];
    var program;

    if (!image) {

        var programOptions = bucket.paintAttributes.fill[layer.id];
        program = painter.useProgram(
            'fill',
            programOptions.defines,
            programOptions.vertexPragmas,
            programOptions.fragmentPragmas
        );
        bucket.setUniforms(gl, 'fill', program, layer, {zoom: painter.transform.zoom});

    } else {
        // Draw texture fill
        program = painter.useProgram('pattern');
        setPattern(image, layer.paint['fill-opacity'], tile, coord, painter, program);

        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);
    }

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['fill-translate'],
        layer.paint['fill-translate-anchor']
    ));

    painter.enableTileClippingMask(coord);

    for (var i = 0; i < bufferGroups.length; i++) {
        var group = bufferGroups[i];
        group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer, group.paintVertexBuffers[layer.id]);
        gl.drawElements(gl.TRIANGLES, group.elementBuffer.length, gl.UNSIGNED_SHORT, 0);
    }
}

function drawStroke(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;

    var gl = painter.gl;
    var bufferGroups = bucket.bufferGroups.fill;

    var image = layer.paint['fill-pattern'];
    var opacity = layer.paint['fill-opacity'];
    var isOutlineColorDefined = layer.getPaintProperty('fill-outline-color');

    var program;
    if (image && !isOutlineColorDefined) {
        program = painter.useProgram('outlinepattern');
        gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    } else {
        var programOptions = bucket.paintAttributes.fill[layer.id];
        program = painter.useProgram(
            'outline',
            programOptions.defines,
            programOptions.vertexPragmas,
            programOptions.fragmentPragmas
        );
        gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform1f(program.u_opacity, opacity);
        bucket.setUniforms(gl, 'fill', program, layer, {zoom: painter.transform.zoom});
    }

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['fill-translate'],
        layer.paint['fill-translate-anchor']
    ));

    if (image) { setPattern(image, opacity, tile, coord, painter, program); }

    painter.enableTileClippingMask(coord);

    for (var k = 0; k < bufferGroups.length; k++) {
        var group = bufferGroups[k];
        group.secondVaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer2, group.paintVertexBuffers[layer.id]);
        gl.drawElements(gl.LINES, group.elementBuffer2.length * 2, gl.UNSIGNED_SHORT, 0);
    }
}


function setPattern(image, opacity, tile, coord, painter, program) {
    var gl = painter.gl;

    var imagePosA = painter.spriteAtlas.getPosition(image.from, true);
    var imagePosB = painter.spriteAtlas.getPosition(image.to, true);
    if (!imagePosA || !imagePosB) return;

    gl.uniform1i(program.u_image, 0);
    gl.uniform2fv(program.u_pattern_tl_a, imagePosA.tl);
    gl.uniform2fv(program.u_pattern_br_a, imagePosA.br);
    gl.uniform2fv(program.u_pattern_tl_b, imagePosB.tl);
    gl.uniform2fv(program.u_pattern_br_b, imagePosB.br);
    gl.uniform1f(program.u_opacity, opacity);
    gl.uniform1f(program.u_mix, image.t);

    gl.uniform1f(program.u_tile_units_to_pixels, 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom));
    gl.uniform2fv(program.u_pattern_size_a, imagePosA.size);
    gl.uniform2fv(program.u_pattern_size_b, imagePosB.size);
    gl.uniform1f(program.u_scale_a, image.fromScale);
    gl.uniform1f(program.u_scale_b, image.toScale);

    var tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom - tile.coord.z);

    var pixelX = tileSizeAtNearestZoom * (tile.coord.x + coord.w * Math.pow(2, tile.coord.z));
    var pixelY = tileSizeAtNearestZoom * tile.coord.y;
    // split the pixel coord into two pairs of 16 bit numbers. The glsl spec only guarantees 16 bits of precision.
    gl.uniform2f(program.u_pixel_coord_upper, pixelX >> 16, pixelY >> 16);
    gl.uniform2f(program.u_pixel_coord_lower, pixelX & 0xFFFF, pixelY & 0xFFFF);

    gl.activeTexture(gl.TEXTURE0);
    painter.spriteAtlas.bind(gl, true);
}
