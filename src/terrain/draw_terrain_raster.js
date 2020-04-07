// @flow

import Point from '@mapbox/point-geometry';

import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {terrainRasterUniformValues} from './terrain_raster_program';
import {Terrain} from './terrain';

import type Painter from '../render/painter';
import type SourceCache from '../source/source_cache';
import type {OverscaledTileID} from '../source/tile_id';

export default drawTerrainRaster;

function drawTerrainRaster(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>) {
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('terrainRaster');

    const colorMode = painter.colorModeForRenderPass();

    const cameraCoordinate = painter.transform.pointCoordinate(painter.transform.getCameraPoint());
    const cameraPoint = new Point(cameraCoordinate.x, cameraCoordinate.y);
    const coords = tileIDs.sort((a, b) => {
        if (b.overscaledZ - a.overscaledZ) return b.overscaledZ - a.overscaledZ;
        const aPoint = new Point(a.canonical.x + (1 << a.canonical.z) * a.wrap, a.canonical.y);
        const bPoint = new Point(b.canonical.x + (1 << b.canonical.z) * b.wrap, b.canonical.y);
        const cameraScaled = cameraPoint.mult(1 << a.canonical.z);
        cameraScaled.x -= 0.5;
        cameraScaled.y -= 0.5;
        return cameraScaled.distSqr(aPoint) - cameraScaled.distSqr(bPoint);
    });

    for (const coord of coords) {
        const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
        const tile = sourceCache.getTile(coord);
        const stencilMode = terrain.stencilModeForRTTOverlap(coord, sourceCache);

        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        const uniformValues = terrainRasterUniformValues(coord.posMatrix, painter.transform.zoom);
        terrain.setupDrawForTile(tile, program);

        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, "terrain_raster", terrain.gridBuffer, terrain.gridIndexBuffer, terrain.gridSegments);
    }
}
