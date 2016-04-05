'use strict';

var util = require('../util/util');
var pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = draw;

function draw(painter, source, layer, coords) {
    var gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    var color = util.premultiply(layer.paint['fill-color'], layer.paint['fill-opacity']);
    var image = layer.paint['fill-pattern'];
    var strokeColor = util.premultiply(layer.paint['fill-outline-color'], layer.paint['fill-opacity']);

    // Draw fill
    if (image ? !painter.isOpaquePass : painter.isOpaquePass === (color[3] === 1)) {
        // Once we switch to earcut drawing we can pull most of the WebGL setup
        // outside of this coords loop.
        for (var i = 0; i < coords.length; i++) {
            drawFill(painter, source, layer, coords[i]);
        }
    }

    // Draw stroke
    if (!painter.isOpaquePass && layer.paint['fill-antialias']) {
        if (strokeColor || !layer.paint['fill-pattern']) {
            var outlineProgram = painter.useProgram('outline');
            painter.lineWidth(2);
            painter.depthMask(false);

            if (strokeColor) {
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
            gl.uniform2f(outlineProgram.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
            gl.uniform4fv(outlineProgram.u_color, strokeColor ? strokeColor : color);

            for (var j = 0; j < coords.length; j++) {
                drawStroke(painter, source, layer, coords[j]);
            }
        } else {
            var outlinePatternProgram = painter.useProgram('outlinepattern');
            painter.lineWidth(2);
            painter.depthMask(false);
            // Otherwise, we only want to drawFill the antialiased parts that are
            // *outside* the current shape. This is important in case the fill
            // or stroke color is translucent. If we wouldn't clip to outside
            // the current shape, some pixels from the outline stroke overlapped
            // the (non-antialiased) fill.
            painter.setDepthSublayer(0);
            gl.uniform2f(outlinePatternProgram.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

            for (var k = 0; k < coords.length; k++) {
                drawStroke(painter, source, layer, coords[k]);
            }
        }

    }
}

function drawFill(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;
    var elementGroups = bucket.elementGroups.fill;
    if (!elementGroups) return;

    var gl = painter.gl;

    var color = util.premultiply(layer.paint['fill-color'], layer.paint['fill-opacity']);
    var image = layer.paint['fill-pattern'];
    var opacity = layer.paint['fill-opacity'];

    var posMatrix = coord.posMatrix;
    var translatedPosMatrix = painter.translatePosMatrix(posMatrix, tile, layer.paint['fill-translate'], layer.paint['fill-translate-anchor']);

    // Draw the stencil mask.
    painter.setDepthSublayer(1);

    // We're only drawFilling to the first seven bits (== support a maximum of
    // 8 overlapping polygons in one place before we get rendering errors).
    gl.stencilMask(0x07);
    gl.clear(gl.STENCIL_BUFFER_BIT);

    // Draw front facing triangles. Wherever the 0x80 bit is 1, we are
    // increasing the lower 7 bits by one if the triangle is a front-facing
    // triangle. This means that all visible polygons should be in CCW
    // orientation, while all holes (see below) are in CW orientation.
    painter.enableTileClippingMask(coord);

    // When we do a nonzero fill, we count the number of times a pixel is
    // covered by a counterclockwise polygon, and subtract the number of
    // times it is "uncovered" by a clockwise polygon.
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
    gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);

    // When drawFilling a shape, we first drawFill all shapes to the stencil buffer
    // and incrementing all areas where polygons are
    gl.colorMask(false, false, false, false);
    painter.depthMask(false);

    // Draw the actual triangle fan into the stencil buffer.
    var fillProgram = painter.useProgram('fill', translatedPosMatrix);

    // Draw all buffers
    var vertex = bucket.buffers.fillVertex;
    vertex.bind(gl);

    var elements = bucket.buffers.fillElement;
    elements.bind(gl);

    for (var i = 0; i < elementGroups.length; i++) {
        var group = elementGroups[i];
        var offset = group.vertexStartIndex * vertex.itemSize;
        vertex.setAttribPointers(gl, fillProgram, offset);

        var count = group.elementLength * 3;
        var elementOffset = group.elementStartIndex * elements.itemSize;
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, elementOffset);
    }

    // Now that we have the stencil mask in the stencil buffer, we can start
    // writing to the color buffer.
    gl.colorMask(true, true, true, true);
    painter.depthMask(true);

    // From now on, we don't want to update the stencil buffer anymore.
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.stencilMask(0x0);
    var program;

    if (image) {
        // Draw texture fill
        program = painter.useProgram('pattern', posMatrix);
        setPattern(image, opacity, tile, coord, painter, program);

        gl.activeTexture(gl.TEXTURE0);
        painter.spriteAtlas.bind(gl, true);

    } else {
        // Draw filling rectangle.
        program = painter.useProgram('fill', posMatrix);
        gl.uniform4fv(fillProgram.u_color, color);
    }

    // Only draw regions that we marked
    gl.stencilFunc(gl.NOTEQUAL, 0x0, 0x07);
    gl.bindBuffer(gl.ARRAY_BUFFER, painter.tileExtentBuffer);
    gl.vertexAttribPointer(program.a_pos, painter.tileExtentBuffer.itemSize, gl.SHORT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, painter.tileExtentBuffer.itemCount);

    gl.stencilMask(0x00);
}

function drawStroke(painter, source, layer, coord) {
    var tile = source.getTile(coord);
    var bucket = tile.getBucket(layer);
    if (!bucket) return;

    var gl = painter.gl;
    var elementGroups = bucket.elementGroups.fill;

    var image = layer.paint['fill-pattern'];
    var opacity = layer.paint['fill-opacity'];
    var program = image ? painter.useProgram('outlinepattern') : painter.useProgram('outline');

    painter.setPosMatrix(painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['fill-translate'],
        layer.paint['fill-translate-anchor']
    ));

    if (image) { setPattern(image, opacity, tile, coord, painter, program); }

    // Draw all buffers
    var vertex = bucket.buffers.fillVertex;
    var elements = bucket.buffers.fillSecondElement;
    vertex.bind(gl);
    elements.bind(gl);

    painter.enableTileClippingMask(coord);

    for (var k = 0; k < elementGroups.length; k++) {
        var group = elementGroups[k];
        var offset = group.vertexStartIndex * vertex.itemSize;
        vertex.setAttribPointers(gl, program, offset);

        var count = group.secondElementLength * 2;
        var elementOffset = group.secondElementStartIndex * elements.itemSize;
        gl.drawElements(gl.LINES, count, gl.UNSIGNED_SHORT, elementOffset);
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

    var imageSizeScaledA = [
        (imagePosA.size[0] * image.fromScale),
        (imagePosA.size[1] * image.fromScale)
    ];
    var imageSizeScaledB = [
        (imagePosB.size[0] * image.toScale),
        (imagePosB.size[1] * image.toScale)
    ];

    gl.uniform2fv(program.u_patternscale_a, [
        1 / pixelsToTileUnits(tile, imageSizeScaledA[0], painter.transform.tileZoom),
        1 / pixelsToTileUnits(tile, imageSizeScaledA[1], painter.transform.tileZoom)
    ]);

    gl.uniform2fv(program.u_patternscale_b, [
        1 / pixelsToTileUnits(tile, imageSizeScaledB[0], painter.transform.tileZoom),
        1 / pixelsToTileUnits(tile, imageSizeScaledB[1], painter.transform.tileZoom)
    ]);

    var tileSizeAtNearestZoom = tile.tileSize * Math.pow(2, painter.transform.tileZoom - tile.coord.z);

    // shift images to match at tile boundaries
    var offsetAx = ((tileSizeAtNearestZoom / imageSizeScaledA[0]) % 1) * (tile.coord.x + coord.w * Math.pow(2, tile.coord.z));
    var offsetAy = ((tileSizeAtNearestZoom / imageSizeScaledA[1]) % 1) * tile.coord.y;

    var offsetBx = ((tileSizeAtNearestZoom / imageSizeScaledB[0]) % 1) * (tile.coord.x + coord.w * Math.pow(2, tile.coord.z));
    var offsetBy = ((tileSizeAtNearestZoom / imageSizeScaledB[1]) % 1) * tile.coord.y;

    gl.uniform2fv(program.u_offset_a, [offsetAx, offsetAy]);
    gl.uniform2fv(program.u_offset_b, [offsetBx, offsetBy]);

    gl.activeTexture(gl.TEXTURE0);
    painter.spriteAtlas.bind(gl, true);
}
