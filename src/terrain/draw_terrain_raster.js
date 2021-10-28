// @flow

import {mat4, vec3} from 'gl-matrix';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {terrainRasterUniformValues} from './terrain_raster_program.js';
import {globeRasterUniformValues} from './globe_raster_program.js';
import {Terrain} from './terrain.js';
import Tile from '../source/tile.js';
import assert from 'assert';
import {members as globeLayoutAttributes} from './globe_attributes.js';
import {easeCubicInOut, clamp, degToRad} from '../util/util.js';
import {GlobeVertexArray} from '../data/array_types.js';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate.js';
import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';
import {
    tileLatLngCorners,
    latLngToECEF,
    tileBoundsOnGlobe,
    denormalizeECEF,
    normalizeECEF,
    GlobeSharedBuffers,
    GLOBE_VERTEX_GRID_SIZE,
    globeToMercatorTransition
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

const lerp = (a, b, t) => a * (1 - t) + b * t;

function createGridVertices(painter, count: number, sx, sy, sz): any {
    const tiles = Math.pow(2, sz);
    const gridTileId = new CanonicalTileID(sz, sx, sy);
    const [latLngTL, latLngBR] = tileLatLngCorners(gridTileId);
    const boundsArray = new GlobeVertexArray();

    const bounds = tileBoundsOnGlobe(new CanonicalTileID(sz, tiles / 2, sy));
    const norm = normalizeECEF(bounds);

    const gridExt = count;
    const vertexExt = gridExt + 1;
    boundsArray.reserve(count * count);

    for (let y = 0; y < vertexExt; y++) {
        const lat = lerp(latLngTL[0], latLngBR[0], y / gridExt);
        const mercY = clamp(mercatorYfromLat(lat), 0, 1);
        const uvY = (mercY * tiles) - sy;
        for (let x = 0; x < vertexExt; x++) {
            const uvX = x / gridExt;
            const lng = lerp(latLngTL[1], latLngBR[1], uvX);

            const pGlobe = latLngToECEF(lat, lng);
            vec3.transformMat4(pGlobe, pGlobe, norm);

            const mercatorX = mercatorXfromLng(lng);
            const mercatorY = mercatorYfromLat(lat);

            boundsArray.emplaceBack(pGlobe[0], pGlobe[1], pGlobe[2], mercatorX, mercatorY, uvX, uvY);
        }
    }

    return boundsArray;
}

function createPoleTriangleVertices(fanSize, tiles, ws, topCap) {
    const arr = new GlobeVertexArray();
    const radius = ws / Math.PI / 2.0;

    // Place the tip
    arr.emplaceBack(0, -radius, 0, 0, 0, 0.5, topCap ? 0.0 : 1.0);

    const startAngle = 0;
    const endAngle = 360.0 / tiles;

    for (let i = 0; i <= fanSize; i++) {
        const uvX = i / fanSize;
        const angle = lerp(startAngle, endAngle, uvX);
        const p = latLngToECEF(85, angle, radius);

        arr.emplaceBack(p[0], p[1], p[2], 0, 0, uvX, topCap ? 0.0 : 1.0);
    }

    return arr;
}

function prepareBuffersForTileMesh(painter: Painter, tile: Tile, coord: OverscaledTileID, tiles: number) {
    const context = painter.context;
    const id = coord.canonical;
    const tr = painter.transform;
    if (!tile.globeGridBuffer) {
        const gridMesh = createGridVertices(painter, GLOBE_VERTEX_GRID_SIZE, id.x, id.y, id.z);
        tile.globeGridBuffer = context.createVertexBuffer(gridMesh, globeLayoutAttributes, false);
    }

    if (!tile.globePoleBuffer && (coord.canonical.y === 0 || coord.canonical.y === tiles - 1)) {
        const poleMesh = createPoleTriangleVertices(GLOBE_VERTEX_GRID_SIZE, tiles, tr.tileSize * tiles, coord.canonical.y === 0);
        tile.globePoleBuffer = context.createVertexBuffer(poleMesh, globeLayoutAttributes, false);
    }

    if (!painter.globeSharedBuffers) {
        painter.globeSharedBuffers = new GlobeSharedBuffers(context);
    }
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
        const modes = [shaderDefines[mode]];
        if (isWireframe) modes.push(shaderDefines[showWireframe]);
        program = painter.useProgram('globeRaster', null, modes);
        programMode = mode;
    };

    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    vertexMorphing.update(now);
    const tr = painter.transform;
    const globeMatrix = tr.calculateGlobeMatrix(tr.worldSize);
    const globeMercatorMatrix = tr.calculateGlobeMercatorMatrix(tr.worldSize);
    const mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
    const batches = showWireframe ? [false, true] : [false];

    batches.forEach(isWireframe => {
        // This code assumes the rendering is batched into mesh terrain and then wireframe
        // terrain (if applicable) so that this is enough to ensure the correct program is
        // set when we switch from one to the other.
        programMode = -1;

        const primitive = isWireframe ? gl.LINES : gl.TRIANGLES;

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            const tiles = Math.pow(2, coord.canonical.z);

            prepareBuffersForTileMesh(painter, tile, coord, tiles);

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
                //elevationOptions = {morphing: {srcDemTile: morph.from, dstDemTile: morph.to, phase: easeCubicInOut(morph.phase)}};
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

            program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
                uniformValues, "globe_raster", tile.globeGridBuffer, painter.globeSharedBuffers.gridIndexBuffer, painter.globeSharedBuffers.gridSegments, null, null, null, null);

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

                program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                    poleUniforms, "globe_pole_raster", tile.globePoleBuffer, painter.globeSharedBuffers.poleIndexBuffer, painter.globeSharedBuffers.poleSegments);
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
        const globeMercatorMatrix = tr.calculateGlobeMercatorMatrix(tr.worldSize);
        const globeMatrix = tr.calculateGlobeMatrix(tr.worldSize);
        const mercatorCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            const tiles = Math.pow(2, coord.canonical.z);

            prepareBuffersForTileMesh(painter, tile, coord, tiles);

            const gridTileId = new CanonicalTileID(coord.canonical.z, tiles / 2, coord.canonical.y);
            const elevationOptions = {elevationTileID: gridTileId};
            terrain.setupElevationDraw(tile, program, elevationOptions);

            const posMatrix = globeMatrixForTile(coord.canonical, globeMatrix);
            const uniformValues = globeRasterUniformValues(
                tr.projMatrix, posMatrix, globeMercatorMatrix,
                globeToMercatorTransition(tr.zoom), mercatorCenter,
                globeUpVectorMatrix(coord.canonical, tiles));

            program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.unblended, CullFaceMode.backCCW,
                uniformValues, "globe_raster_depth", tile.globeGridBuffer, painter.globeSharedBuffers.gridIndexBuffer, painter.globeSharedBuffers.gridSegments, null, null, null, null);
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
