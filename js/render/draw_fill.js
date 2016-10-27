'use strict';

const setPattern = require('./set_pattern');

module.exports = draw;

function draw(painter, sourceCache, layer, coords) {
    const gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    const isOpaque = (
        !layer.paint['fill-pattern'] &&
        layer.isPaintValueFeatureConstant('fill-color') &&
        layer.isPaintValueFeatureConstant('fill-opacity') &&
        layer.paint['fill-color'][3] === 1 &&
        layer.paint['fill-opacity'] === 1
    );

    // Draw fill
    if (painter.isOpaquePass === isOpaque) {
        // Once we switch to earcut drawing we can pull most of the WebGL setup
        // outside of this coords loop.
        painter.setDepthSublayer(1);
        for (let i = 0; i < coords.length; i++) {
            drawFill(painter, sourceCache, layer, coords[i]);
        }
    }

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

        for (let j = 0; j < coords.length; j++) {
            drawStroke(painter, sourceCache, layer, coords[j]);
        }
    }
}

function drawFill(painter, sourceCache, layer, coord) {
    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) return;

    const buffers = bucket.buffers;
    const gl = painter.gl;

    const image = layer.paint['fill-pattern'];
    const layerData = buffers.layerData[layer.id];

    let program;

    if (!image) {
        const programConfiguration = layerData.programConfiguration;
        program = painter.useProgram('fill', programConfiguration);
        programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});

    } else {
        // Draw texture fill
        program = painter.useProgram('fillPattern');
        setPattern(image, tile, coord, painter, program, false);
        gl.uniform1f(program.u_opacity, layer.paint['fill-opacity']);

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

    for (const segment of buffers.segments) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.TRIANGLES, segment.primitiveLength * 3, gl.UNSIGNED_SHORT, segment.primitiveOffset * 3 * 2);
    }
}

function drawStroke(painter, sourceCache, layer, coord) {
    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) return;

    const buffers = bucket.buffers;
    const layerData = buffers.layerData[layer.id];
    const gl = painter.gl;

    const image = layer.paint['fill-pattern'];
    const isOutlineColorDefined = layer.getPaintProperty('fill-outline-color');
    let program;

    if (image && !isOutlineColorDefined) {
        program = painter.useProgram('fillOutlinePattern');
        gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    } else {
        const programConfiguration = layerData.programConfiguration;
        program = painter.useProgram('fillOutline', programConfiguration);
        programConfiguration.setUniforms(gl, program, layer, {zoom: painter.transform.zoom});
        gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    gl.uniform1f(program.u_opacity, layer.paint['fill-opacity']);

    gl.uniformMatrix4fv(program.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix,
        tile,
        layer.paint['fill-translate'],
        layer.paint['fill-translate-anchor']
    ));

    if (image) {
        setPattern(image, tile, coord, painter, program, false);
    }

    painter.enableTileClippingMask(coord);

    for (const segment of buffers.segments2) {
        segment.vaos[layer.id].bind(gl, program, buffers.layoutVertexBuffer, buffers.elementBuffer2, layerData.paintVertexBuffer, segment.vertexOffset);
        gl.drawElements(gl.LINES, segment.primitiveLength * 2, gl.UNSIGNED_SHORT, segment.primitiveOffset * 2 * 2);
    }
}
