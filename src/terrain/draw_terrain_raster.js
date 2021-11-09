// @flow

import {mat4} from 'gl-matrix';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {terrainRasterUniformValues} from './terrain_raster_program.js';
import {globeRasterUniformValues} from './globe_raster_program.js';
import {Terrain} from './terrain.js';
import Tile from '../source/tile.js';
import assert from 'assert';
import type VertexBuffer from '../gl/vertex_buffer.js';
import {members as globeLayoutAttributes} from './globe_attributes.js';
import {easeCubicInOut, degToRad} from '../util/util.js';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.js';
import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';
import {
    tileBoundsOnGlobe,
    denormalizeECEF,
    globeToMercatorTransition,
    GlobeSharedBuffers,
    calculateGlobeMatrix,
    calculateGlobeMercatorMatrix
} from '../geo/projection/globe.js';
import extend from '../style-spec/util/extend.js';

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

function prepareGlobeBuffersForTileMesh(painter: Painter, tile: Tile, coord: OverscaledTileID, tiles: number): [VertexBuffer, VertexBuffer] {
    const context = painter.context;
    const id = coord.canonical;
    const tr = painter.transform;
    let gridBuffer = tile.globeGridBuffer;
    let poleBuffer = tile.globePoleBuffer;

    if (!gridBuffer) {
        const gridMesh = GlobeSharedBuffers.createGridVertices(id.x, id.y, id.z);
        gridBuffer = tile.globeGridBuffer = context.createVertexBuffer(gridMesh, globeLayoutAttributes, false);
    }

    if (!poleBuffer) {
        const poleMesh = GlobeSharedBuffers.createPoleTriangleVertices(tiles, tr.tileSize * tiles, coord.canonical.y === 0);
        poleBuffer = tile.globePoleBuffer = context.createVertexBuffer(poleMesh, globeLayoutAttributes, false);
    }

    return [gridBuffer, poleBuffer];
}

function globeMatrixForTile(id: CanonicalTileID, globeMatrix) {
    const gridTileId = new CanonicalTileID(id.z, Math.pow(2, id.z) / 2, id.y);
    const bounds = tileBoundsOnGlobe(gridTileId);
    const decode = denormalizeECEF(bounds);
    const posMatrix = mat4.clone(globeMatrix);
    mat4.mul(posMatrix, posMatrix, decode);

    return posMatrix;
}

function globeUpVectorMatrix(id: CanonicalTileID, tiles: number) {
    // Tile up vectors and can be reused for each tiles on the same x-row.
    // i.e. for each tile id (x, y, z) use pregenerated mesh of (0, y, z).
    // For this reason the up vectors are rotated first by 'yRotation' to
    // place them in the correct longitude location.
    const xOffset = id.x - tiles / 2;
    const yRotation = xOffset / tiles * Math.PI * 2.0;
    return mat4.fromYRotation([], yRotation);
}

function poleMatrixForTile(id: CanonicalTileID, south, tr) {
    const poleMatrix = mat4.identity(new Float64Array(16));

    const tileDim = Math.pow(2, id.z);
    const xOffset = id.x - tileDim / 2;
    const yRotation = xOffset / tileDim * Math.PI * 2.0;

    const point = tr.point;
    const ws = tr.worldSize;
    const s = tr.worldSize / (tr.tileSize * tileDim);

    mat4.translate(poleMatrix, poleMatrix, [point.x, point.y, -(ws / Math.PI / 2.0)]);
    mat4.scale(poleMatrix, poleMatrix, [s, s, s]);
    mat4.rotateX(poleMatrix, poleMatrix, degToRad(-tr._center.lat));
    mat4.rotateY(poleMatrix, poleMatrix, degToRad(-tr._center.lng));
    mat4.rotateY(poleMatrix, poleMatrix, yRotation);
    if (south) {
        mat4.scale(poleMatrix, poleMatrix, [1, -1, 1]);
    }

    return poleMatrix;
}

function drawTerrainForGlobe(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>, now: number) {
    const context = painter.context;
    const gl = context.gl;

    let program, programMode;
    const showWireframe = painter.options.showTerrainWireframe ? SHADER_TERRAIN_WIREFRAME : SHADER_DEFAULT;

    const setShaderMode = (mode, isWireframe) => {
        if (programMode === mode)
            return;
        const defines = ([]: any);
        if (isWireframe) {
            defines.push(shaderDefines[showWireframe]);
        }
        defines.push(shaderDefines[mode]);
        defines.push('PROJECTION_GLOBE_VIEW');
        program = painter.useProgram('globeRaster', null, defines);
        programMode = mode;
    };

    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    vertexMorphing.update(now);
    const tr = painter.transform;
    const globeMatrix = calculateGlobeMatrix(tr, tr.worldSize);
    const globeMercatorMatrix = calculateGlobeMercatorMatrix(tr);
    const mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
    const batches = showWireframe ? [false, true] : [false];
    const sharedBuffers = painter.globeSharedBuffers;

    batches.forEach(isWireframe => {
        // This code assumes the rendering is batched into mesh terrain and then wireframe
        // terrain (if applicable) so that this is enough to ensure the correct program is
        // set when we switch from one to the other.
        programMode = -1;

        const primitive = isWireframe ? gl.LINES : gl.TRIANGLES;

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            const tiles = Math.pow(2, coord.canonical.z);
            const [gridBuffer, poleBuffer] = prepareGlobeBuffersForTileMesh(painter, tile, coord, tiles);
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
            let elevationOptions = {};

            if (morph) {
                extend(elevationOptions, {morphing: {srcDemTile: morph.from, dstDemTile: morph.to, phase: easeCubicInOut(morph.phase)}});
            }

            const posMatrix = globeMatrixForTile(coord.canonical, globeMatrix);
            const upvectorMatrix = globeUpVectorMatrix(coord.canonical, tiles);

            const uniformValues = globeRasterUniformValues(
                tr.projMatrix, posMatrix, globeMercatorMatrix,
                globeToMercatorTransition(tr.zoom),
                mercatorCenter, upvectorMatrix);

            setShaderMode(shaderMode, isWireframe);

            const gridTileId = new CanonicalTileID(coord.canonical.z, tiles / 2, coord.canonical.y);
            elevationOptions = extend(elevationOptions, {elevationTileID: gridTileId});
            terrain.setupElevationDraw(tile, program, elevationOptions);

            painter.prepareDrawProgram(context, program, coord.toUnwrapped());

            if (sharedBuffers) {
                const [buffer, segments] = isWireframe ?
                    sharedBuffers.getWirefameBuffer(painter.context) :
                    [sharedBuffers.gridIndexBuffer, sharedBuffers.gridSegments];

                program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
                    uniformValues, "globe_raster", gridBuffer, buffer, segments);
            }

            if (!isWireframe) {
                // Fill poles by extrapolating adjacent border tiles
                const poleMatrices = [
                    coord.canonical.y === 0 ? poleMatrixForTile(coord.canonical, false, tr) : null,
                    coord.canonical.y === tiles - 1 ? poleMatrixForTile(coord.canonical, true, tr) : null
                ];

                for (const poleMatrix of poleMatrices) {
                    if (!poleMatrix) {
                        continue;
                    }

                    const poleUniforms = globeRasterUniformValues(
                        tr.projMatrix, poleMatrix, poleMatrix,
                        0.0, mercatorCenter, upvectorMatrix);

                    if (sharedBuffers) {
                        program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                            poleUniforms, "globe_pole_raster", poleBuffer, sharedBuffers.poleIndexBuffer, sharedBuffers.poleSegments);
                    }
                }
            }
        }
    });
}

function drawTerrainRaster(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>, now: number) {
    if (painter.transform.projection.name === 'globe') {
        drawTerrainForGlobe(painter, terrain, sourceCache, tileIDs, now);
    } else {
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
}

function drawTerrainDepth(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>) {
    if (painter.transform.projection.name === 'globe') {
        assert(painter.renderPass === 'offscreen');

        const context = painter.context;
        const gl = context.gl;
        const tr = painter.transform;

        context.clear({depth: 1});
        const program = painter.useProgram('globeDepth');
        const depthMode = new DepthMode(gl.LESS, DepthMode.ReadWrite, painter.depthRangeFor3D);
        const globeMercatorMatrix = calculateGlobeMercatorMatrix(tr);
        const globeMatrix = calculateGlobeMatrix(tr, tr.worldSize);
        const mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
        const sharedBuffers = painter.globeSharedBuffers;

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            const tiles = Math.pow(2, coord.canonical.z);

            const [gridBuffer] = prepareGlobeBuffersForTileMesh(painter, tile, coord, tiles);

            const gridTileId = new CanonicalTileID(coord.canonical.z, tiles / 2, coord.canonical.y);
            const elevationOptions = {elevationTileID: gridTileId};
            terrain.setupElevationDraw(tile, program, elevationOptions);

            const posMatrix = globeMatrixForTile(coord.canonical, globeMatrix);
            const uniformValues = globeRasterUniformValues(
                tr.projMatrix, posMatrix, globeMercatorMatrix,
                globeToMercatorTransition(tr.zoom), mercatorCenter,
                globeUpVectorMatrix(coord.canonical, tiles));

            if (sharedBuffers) {
                program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.unblended, CullFaceMode.backCCW,
                    uniformValues, "globe_raster_depth", gridBuffer, sharedBuffers.gridIndexBuffer, sharedBuffers.gridSegments);
            }
        }
    } else {
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
