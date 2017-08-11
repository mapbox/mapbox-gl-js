// @flow

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type StyleLayer from '../style/style_layer';
import type TileCoord from '../source/tile_coord';
import type SymbolBucket from '../data/bucket/symbol_bucket';

module.exports = drawCollisionDebug;

function drawCollisionDebug(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<TileCoord>) {
    const gl = painter.gl;
    gl.enable(gl.STENCIL_TEST);
    const program = painter.useProgram('collisionBox');

    gl.activeTexture(gl.TEXTURE1);
    painter.frameHistory.bind(gl);
    gl.uniform1i(program.uniforms.u_fadetexture, 1);

    for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];
        const tile = sourceCache.getTile(coord);
        const bucket: ?SymbolBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, coord.posMatrix);

        painter.enableTileClippingMask(coord);

        painter.lineWidth(1);
        gl.uniform1f(program.uniforms.u_scale, Math.pow(2, painter.transform.zoom - tile.coord.z));
        gl.uniform1f(program.uniforms.u_zoom, painter.transform.zoom * 10);
        const maxZoom = Math.max(0, Math.min(25, tile.coord.z + Math.log((tile.collisionTile: any).maxScale) / Math.LN2));
        gl.uniform1f(program.uniforms.u_maxzoom, maxZoom * 10);

        gl.uniform1f(program.uniforms.u_collision_y_stretch, (tile.collisionTile: any).yStretch);
        gl.uniform1f(program.uniforms.u_pitch, painter.transform.pitch / 360 * 2 * Math.PI);
        gl.uniform1f(program.uniforms.u_camera_to_center_distance, painter.transform.cameraToCenterDistance);

        for (const segment of bucket.collisionBox.segments.get()) {
            segment.vaos[layer.id].bind(gl, program, bucket.collisionBox.layoutVertexBuffer, bucket.collisionBox.elementBuffer, null, segment.vertexOffset);
            gl.drawElements(gl.LINES, segment.primitiveLength * 2, gl.UNSIGNED_SHORT, segment.primitiveOffset * 2 * 2);
        }
    }
}
