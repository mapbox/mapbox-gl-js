// @flow

import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {terrainRasterUniformValues} from './terrain_raster_program.js';
import {Terrain} from './terrain.js';
import Tile from '../source/tile.js';
import assert from 'assert';
import {easeCubicInOut} from '../util/util.js';

import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import type {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';

export {
    drawTerrainRaster,
    drawTerrainDepth
};

type DEMChain = {
    startTime: number,
    phase: number,
    duration: number,   // Interpolation duration in milliseconds
    from: Tile,
    to: Tile,
    queued: ?Tile
};

class VertexMorphing {
    operations: {[string | number]: DEMChain };

    constructor() {
        this.operations = {};
    }

    newMorphing(key: number, from: Tile, to: Tile, now: number, duration: number) {
        assert(from.demTexture && to.demTexture);
        assert(from.tileID.key !== to.tileID.key);

        if (key in this.operations) {
            const op = this.operations[key];
            assert(op.from && op.to);
            // Queue the target tile unless it's being morphed to already
            if (op.to.tileID.key !== to.tileID.key)
                op.queued = to;
        } else {
            this.operations[key] = {
                startTime: now,
                phase: 0.0,
                duration,
                from,
                to,
                queued: null
            };
        }
    }

    getMorphValuesForProxy(key: number): ?{from: Tile, to: Tile, phase: number} {
        if (!(key in this.operations))
            return null;

        const op = this.operations[key];
        const from = op.from;
        const to = op.to;
        assert(from && to);

        return {from, to, phase: op.phase};
    }

    update(now: number) {
        for (const key in this.operations) {
            const op = this.operations[key];
            assert(op.from && op.to);

            op.phase = (now - op.startTime) / op.duration;

            // Start the queued operation if the current one is finished or the data has expired
            while (op.phase >= 1.0 || !this._validOp(op)) {
                if (!this._nextOp(op, now)) {
                    delete this.operations[key];
                    break;
                }
            }
        }
    }

    _nextOp(op: DEMChain, now: number): boolean {
        if (!op.queued)
            return false;
        op.from = op.to;
        op.to = op.queued;
        op.queued = null;
        op.phase = 0.0;
        op.startTime = now;
        return true;
    }

    _validOp(op: DEMChain): boolean {
        return op.from.hasData() && op.to.hasData();
    }
}

function demTileChanged(prev: ?Tile, next: ?Tile): boolean {
    if (prev == null || next == null)
        return false;
    if (!prev.hasData() || !next.hasData())
        return false;
    if (prev.demTexture == null || next.demTexture == null)
        return false;
    return prev.tileID.key !== next.tileID.key;
}

const vertexMorphing = new VertexMorphing();
const SHADER_DEFAULT = 0;
const SHADER_MORPHING = 1;
const SHADER_TERRAIN_WIREFRAME = 2;
const defaultDuration = 250;

const shaderDefines = {
    "0": null,
    "1": 'TERRAIN_VERTEX_MORPHING',
    "2": 'TERRAIN_WIREFRAME'
};

function drawTerrainRaster(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>, now: number) {
    const context = painter.context;
    const gl = context.gl;

    let program, programMode;
    const showWireframe = painter.options.showTerrainWireframe ? SHADER_TERRAIN_WIREFRAME : SHADER_DEFAULT;

    const setShaderMode = (mode, isWireframe) => {
        if (programMode === mode)
            return;
        const modes = [shaderDefines[mode]];
        if (isWireframe) modes.push(shaderDefines[showWireframe]);
        program = painter.useProgram('terrainRaster', null, modes);
        programMode = mode;
    };

    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    vertexMorphing.update(now);
    const tr = painter.transform;
    const skirt = skirtHeight(tr.zoom) * terrain.exaggeration();

    const batches = showWireframe ? [false, true] : [false];

    batches.forEach(isWireframe => {
        // This code assumes the rendering is batched into mesh terrain and then wireframe
        // terrain (if applicable) so that this is enough to ensure the correct program is
        // set when we switch from one to the other.
        programMode = -1;

        const primitive = isWireframe ? gl.LINES : gl.TRIANGLES;
        const [buffer, segments] = isWireframe ? terrain.getWirefameBuffer() : [terrain.gridIndexBuffer, terrain.gridSegments];

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            const stencilMode = StencilMode.disabled;

            const prevDemTile = terrain.prevTerrainTileForTile[coord.key];
            const nextDemTile = terrain.terrainTileForTile[coord.key];

            if (demTileChanged(prevDemTile, nextDemTile)) {
                vertexMorphing.newMorphing(coord.key, prevDemTile, nextDemTile, now, defaultDuration);
            }

            // Bind the main draped texture
            context.activeTexture.set(gl.TEXTURE0);
            tile.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE, gl.LINEAR_MIPMAP_NEAREST);

            const morph = vertexMorphing.getMorphValuesForProxy(coord.key);
            const shaderMode = morph ? SHADER_MORPHING : SHADER_DEFAULT;
            let elevationOptions;

            if (morph) {
                elevationOptions = {morphing: {srcDemTile: morph.from, dstDemTile: morph.to, phase: easeCubicInOut(morph.phase)}};
            }

            const uniformValues = terrainRasterUniformValues(coord.projMatrix, isEdgeTile(coord.canonical, tr.renderWorldCopies) ? skirt / 10 : skirt);

            setShaderMode(shaderMode, isWireframe);

            terrain.setupElevationDraw(tile, program, elevationOptions);

            painter.prepareDrawProgram(context, program, coord.toUnwrapped());

            program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
                uniformValues, "terrain_raster", terrain.gridBuffer, buffer, segments);
        }
    });
}

function drawTerrainDepth(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>) {
    assert(painter.renderPass === 'offscreen');

    const context = painter.context;
    const gl = context.gl;
    context.clear({depth: 1});
    const program = painter.useProgram('terrainDepth');
    const depthMode = new DepthMode(gl.LESS, DepthMode.ReadWrite, painter.depthRangeFor3D);

    for (const coord of tileIDs) {
        const tile = sourceCache.getTile(coord);
        const uniformValues = terrainRasterUniformValues(coord.projMatrix, 0);
        terrain.setupElevationDraw(tile, program);
        program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.unblended, CullFaceMode.backCCW,
            uniformValues, "terrain_depth", terrain.gridBuffer, terrain.gridIndexBuffer, terrain.gridNoSkirtSegments);
    }
}

function skirtHeight(zoom) {
    // Skirt height calculation is heuristic: provided value hides
    // seams between tiles and it is not too large: 9 at zoom 22, ~20000m at zoom 0.
    return 6 * Math.pow(1.5, 22 - zoom);
}

function isEdgeTile(cid: CanonicalTileID, renderWorldCopies: boolean): boolean {
    const numTiles = 1 << cid.z;
    return (!renderWorldCopies && (cid.x === 0 || cid.x === numTiles - 1)) || cid.y === 0 || cid.y === numTiles - 1;
}

export {
    VertexMorphing
};
