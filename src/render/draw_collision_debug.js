// @flow

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type StyleLayer from '../style/style_layer';
import type TileCoord from '../source/tile_coord';
import type SymbolBucket from '../data/bucket/symbol_bucket';
const pixelsToTileUnits = require('../source/pixels_to_tile_units');

module.exports = drawCollisionDebug;

function drawCollisionDebugGeometry(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<TileCoord>, drawCircles: boolean) {
    const gl = painter.gl;
    const program = drawCircles ? painter.useProgram('collisionCircle') : painter.useProgram('collisionBox');
    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket: ?SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;
        const buffers = drawCircles ? bucket.collisionCircle : bucket.collisionBox;
        if (!buffers) continue;

        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, coord.posMatrix);

        if (!drawCircles) {
            painter.lineWidth(1);
        }

        gl.uniform1f(program.uniforms.u_camera_to_center_distance, painter.transform.cameraToCenterDistance);
        const pixelRatio = pixelsToTileUnits(tile, 1, painter.transform.zoom);
        const scale = Math.pow(2, painter.transform.zoom - tile.coord.z);
        gl.uniform1f(program.uniforms.u_pixels_to_tile_units, pixelRatio);
        gl.uniform2f(program.uniforms.u_extrude_scale,
            painter.transform.pixelsToGLUnits[0] / (pixelRatio * scale),
            painter.transform.pixelsToGLUnits[1] / (pixelRatio * scale));

        program.draw(
            gl,
            drawCircles ? gl.TRIANGLES : gl.LINES,
            layer.id,
            buffers.layoutVertexBuffer,
            buffers.indexBuffer,
            buffers.segments,
            null,
            buffers.collisionVertexBuffer,
            null);
    }
}

function drawCollisionDebug(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<TileCoord>) {
    drawCollisionDebugGeometry(painter, sourceCache, layer, coords, false);
    drawCollisionDebugGeometry(painter, sourceCache, layer, coords, true);
}
