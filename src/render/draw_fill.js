'use strict';

const pattern = require('./pattern');

module.exports = drawFill;

function drawFill(painter, sourceCache, layer, coords) {
    const gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    const isOpaque =
        !layer.paint['fill-pattern'] &&
        layer.isPaintValueFeatureConstant('fill-color') &&
        layer.isPaintValueFeatureConstant('fill-opacity') &&
        layer.paint['fill-color'][3] === 1 &&
        layer.paint['fill-opacity'] === 1;

    // Draw fill
    if (painter.isOpaquePass === isOpaque) {
        // Once we switch to earcut drawing we can pull most of the WebGL setup
        // outside of this coords loop.
        painter.setDepthSublayer(1);
        drawFillTiles(painter, sourceCache, layer, coords, drawFillTile);
    }

    // Draw stroke
    if (!painter.isOpaquePass && layer.paint['fill-antialias']) {
        painter.lineWidth(2);
        painter.depthMask(false);

        // If we defined a different color for the fill outline, we are
        // going to ignore the bits in 0x07 and just care about the global
        // clipping mask.
        // Otherwise, we only want to drawFill the antialiased parts that are
        // *outside* the current shape. This is important in case the fill
        // or stroke color is translucent. If we wouldn't clip to outside
        // the current shape, some pixels from the outline stroke overlapped
        // the (non-antialiased) fill.
        painter.setDepthSublayer(layer.getPaintProperty('fill-outline-color') ? 2 : 0);
        drawFillTiles(painter, sourceCache, layer, coords, drawStrokeTile);
    }
}

function drawFillTiles(painter, sourceCache, layer, coords, drawFn) {
    let firstTile = true;
    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket = tile.getBucket(layer);
        if (!bucket) continue;

        painter.enableTileClippingMask(coord);
        drawFn(painter, sourceCache, layer, tile, coord, bucket.buffers, firstTile);
        firstTile = false;
    }
}

function drawFillTile(painter, sourceCache, layer, tile, coord, buffers, firstTile) {
    const gl = painter.gl;
    const layerData = buffers.layerData[layer.id];

    const program = setFillProgram('fill', layer.paint['fill-pattern'], painter, layerData, layer, tile, coord, firstTile);

    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}

function drawStrokeTile(painter, sourceCache, layer, tile, coord, buffers, firstTile) {
    const gl = painter.gl;
    const layerData = buffers.layerData[layer.id];
    const usePattern = layer.paint['fill-pattern'] && !layer.getPaintProperty('fill-outline-color');

    const program = setFillProgram('fillOutline', usePattern, painter, layerData, layer, tile, coord, firstTile);
    gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    for (const segment of buffers.segments2) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer2, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.LINES, segment.primitiveLength * 2, gl.UNSIGNED_SHORT, segment.primitiveOffset * 2 * 2);
    }
}

function setFillProgram(programId, usePattern, painter, layerData, layer, tile, coord, firstTile) {
    let program;
    const prevProgram = painter.currentProgram;
    if (!usePattern) {
        program = painter.useProgram(programId, layerData.programConfiguration);
        if (firstTile || program !== prevProgram) {
            layerData.programConfiguration.setUniforms(painter.gl, program, layer, {zoom: painter.transform.zoom});
        }
    } else {
        program = painter.useProgram(`${programId}Pattern`, layerData.programConfiguration);
        if (firstTile || program !== prevProgram) {
            layerData.programConfiguration.setUniforms(painter.gl, program, layer, {zoom: painter.transform.zoom});
            pattern.prepare(layer.paint['fill-pattern'], painter, program);
        }
        pattern.setTile(tile, painter, program);
    }
    painter.gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix, tile,
        layer.paint['fill-translate'],
        layer.paint['fill-translate-anchor']
    ));
    return program;
}
