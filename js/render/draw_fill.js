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
    const bufferGroups = bucket.bufferGroups.fill;
    if (!bufferGroups) return;

    const gl = painter.gl;

    const image = layer.paint['fill-pattern'];
    let program;

    if (!image) {

        const programOptions = bucket.paintAttributes.fill[layer.id];
        program = painter.useProgram(
            'fill',
            programOptions.defines,
            programOptions.vertexPragmas,
            programOptions.fragmentPragmas
        );
        bucket.setUniforms(gl, 'fill', program, layer, {zoom: painter.transform.zoom});

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

    for (let i = 0; i < bufferGroups.length; i++) {
        const group = bufferGroups[i];
        group.vaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer, group.paintVertexBuffers[layer.id]);
        gl.drawElements(gl.TRIANGLES, group.elementBuffer.length, gl.UNSIGNED_SHORT, 0);
    }
}

function drawStroke(painter, sourceCache, layer, coord) {
    const tile = sourceCache.getTile(coord);
    const bucket = tile.getBucket(layer);
    if (!bucket) return;
    const bufferGroups = bucket.bufferGroups.fill;
    if (!bufferGroups) return;

    const gl = painter.gl;

    const image = layer.paint['fill-pattern'];
    const isOutlineColorDefined = layer.getPaintProperty('fill-outline-color');
    let program;

    if (image && !isOutlineColorDefined) {
        program = painter.useProgram('fillOutlinePattern');
        gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    } else {
        const programOptions = bucket.paintAttributes.fill[layer.id];
        program = painter.useProgram(
            'fillOutline',
            programOptions.defines,
            programOptions.vertexPragmas,
            programOptions.fragmentPragmas
        );
        gl.uniform2f(program.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);
        bucket.setUniforms(gl, 'fill', program, layer, {zoom: painter.transform.zoom});
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

    for (let k = 0; k < bufferGroups.length; k++) {
        const group = bufferGroups[k];
        group.secondVaos[layer.id].bind(gl, program, group.layoutVertexBuffer, group.elementBuffer2, group.paintVertexBuffers[layer.id]);
        gl.drawElements(gl.LINES, group.elementBuffer2.length * 2, gl.UNSIGNED_SHORT, 0);
    }
}
