// @flow

import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {terrainRasterUniformValues} from './terrain_raster_program';
import {Terrain} from './terrain';

import type Painter from '../render/painter';
import type SourceCache from '../source/source_cache';
import type {OverscaledTileID} from '../source/tile_id';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';

export {
    drawTerrainRaster,
    drawTerrainDepth
};

function drawTerrainRaster(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>) {
    const context = painter.context;
    const gl = context.gl;
    const program = painter.useProgram('terrainRaster');

    const colorMode = painter.colorModeForRenderPass();

    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);

    for (const coord of tileIDs) {
        const tile = sourceCache.getTile(coord);
        const stencilMode = StencilMode.disabled;

        context.activeTexture.set(gl.TEXTURE0);
        tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

        const uniformValues = terrainRasterUniformValues(coord.posMatrix, painter.transform.zoom);
        terrain.setupElevationDraw(tile, program);

        program.draw(context, gl.TRIANGLES, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
            uniformValues, "terrain_raster", terrain.gridBuffer, terrain.gridIndexBuffer, terrain.gridSegments);
    }
}

function drawTerrainDepth(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>) {
    const context = painter.context;
    const gl = context.gl;
    context.clear({depth: 1});
    const program = painter.useProgram('terrainDepth');
    const depthMode = new DepthMode(gl.LESS, DepthMode.ReadWrite, painter.depthRangeFor3D);

    for (const coord of tileIDs) {
        const tile = sourceCache.getTile(coord);
        const uniformValues = terrainRasterUniformValues(coord.posMatrix, painter.transform.zoom);
        terrain.setupElevationDraw(tile, program);
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.unblended, CullFaceMode.backCCW,
            uniformValues, "terrain_depth", terrain.gridBuffer, terrain.gridIndexBuffer, terrain.gridNoSkirtSegments);
    }
}
