// @flow

const pattern = require('./pattern');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type FillStyleLayer from '../style/style_layer/fill_style_layer';
import type FillBucket from '../data/bucket/fill_bucket';
import type TileCoord from '../source/tile_coord';

module.exports = drawFill;

function drawFill(painter: Painter, sourceCache: SourceCache, layer: FillStyleLayer, coords: Array<TileCoord>) {
    if (layer.isOpacityZero(painter.transform.zoom)) return;

    const gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);

    const pass = (!layer.paint['fill-pattern'] &&
        layer.isPaintValueFeatureConstant('fill-color') &&
        layer.isPaintValueFeatureConstant('fill-opacity') &&
        layer.paint['fill-color'][3] === 1 &&
        layer.paint['fill-opacity'] === 1) ? 'opaque' : 'translucent';

    // Draw fill
    if (painter.renderPass === pass) {
        // Once we switch to earcut drawing we can pull most of the WebGL setup
        // outside of this coords loop.
        painter.setDepthSublayer(1);
        painter.depthMask(painter.renderPass === 'opaque');
        drawFillTiles(painter, sourceCache, layer, coords, drawFillTile);
    }

    // Draw stroke
    if (painter.renderPass === 'translucent' && layer.paint['fill-antialias']) {
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
    if (pattern.isPatternMissing(layer.paint['fill-pattern'], painter)) return;

    let firstTile = true;
    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: ?FillBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        painter.enableTileClippingMask(coord);
        drawFn(painter, sourceCache, layer, tile, coord, bucket, firstTile);
        firstTile = false;
    }
}

function drawFillTile(painter, sourceCache, layer, tile, coord, bucket, firstTile) {
    const gl = painter.gl;
    const programConfiguration = bucket.programConfigurations.get(layer.id);

    const program = setFillProgram('fill', layer.paint['fill-pattern'], painter, programConfiguration, layer, tile, coord, firstTile);

    program.draw(
        gl,
        gl.TRIANGLES,
        layer.id,
        bucket.layoutVertexBuffer,
        bucket.indexBuffer,
        bucket.segments,
        programConfiguration);
}

function drawStrokeTile(painter, sourceCache, layer, tile, coord, bucket, firstTile) {
    const gl = painter.gl;
    const programConfiguration = bucket.programConfigurations.get(layer.id);
    const usePattern = layer.paint['fill-pattern'] && !layer.getPaintProperty('fill-outline-color');

    const program = setFillProgram('fillOutline', usePattern, painter, programConfiguration, layer, tile, coord, firstTile);
    gl.uniform2f(program.uniforms.u_world, gl.drawingBufferWidth, gl.drawingBufferHeight);

    program.draw(
        gl,
        gl.LINES,
        layer.id,
        bucket.layoutVertexBuffer,
        bucket.indexBuffer2,
        bucket.segments2,
        programConfiguration);
}

function setFillProgram(programId, usePattern, painter, programConfiguration, layer, tile, coord, firstTile) {
    let program;
    const prevProgram = painter.currentProgram;
    if (!usePattern) {
        program = painter.useProgram(programId, programConfiguration);
        if (firstTile || program !== prevProgram) {
            programConfiguration.setUniforms(painter.gl, program, layer, {zoom: painter.transform.zoom});
        }
    } else {
        program = painter.useProgram(`${programId}Pattern`, programConfiguration);
        if (firstTile || program !== prevProgram) {
            programConfiguration.setUniforms(painter.gl, program, layer, {zoom: painter.transform.zoom});
            pattern.prepare(layer.paint['fill-pattern'], painter, program);
        }
        pattern.setTile(tile, painter, program);
    }
    painter.gl.uniformMatrix4fv(program.uniforms.u_matrix, false, painter.translatePosMatrix(
        coord.posMatrix, tile,
        layer.paint['fill-translate'],
        layer.paint['fill-translate-anchor']
    ));
    return program;
}
