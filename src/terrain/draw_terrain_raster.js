// @flow

import {vec4, mat4, mat2, vec3, quat} from 'gl-matrix';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import rasterBoundsAttributes from '../data/raster_bounds_attributes.js';
import {terrainRasterUniformValues} from './terrain_raster_program.js';
import {globeRasterUniformValues} from './globe_raster_program.js';
import {Terrain} from './terrain.js';
import Tile from '../source/tile.js';
import assert from 'assert';
import EXTENT from '../data/extent.js';
import {easeCubicInOut, warnOnce, wrap, clamp, degToRad} from '../util/util.js';
import {RasterBoundsArray, GlobeVertexArray, TriangleIndexArray} from '../data/array_types.js';
import {lngFromMercatorX, mercatorXfromLng, latFromMercatorY, mercatorYfromLat, mercatorZfromAltitude} from '../geo/mercator_coordinate.js';
import {createLayout} from '../util/struct_array.js';
import SegmentVector from '../data/segment.js';

import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';
import { array } from '../style-spec/expression/types.js';
import {
    tileLatLngCorners,
    latLngToECEF,
    tileBoundsOnGlobe,
    denormalizeECEF,
    normalizeECEF,
    GlobeSharedBuffers,
    GLOBE_VERTEX_GRID_SIZE,
    globeToMercatorTransition
} from '../geo/projection/globe.js'
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

const layout = createLayout([
    { type: 'Float32', name: 'a_globe_pos', components: 3 },
    { type: 'Float32', name: 'a_merc_pos', components: 3 },
    { type: 'Float32', name: 'a_uv', components: 2 }
]);

const lerp = (a, b, t) => a * (1 - t) + b * t;

function createGridVertices(painter, count: number, sx, sy, sz): any {
    const counter = painter.frameCounter;
    const tr = painter.transform;
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
            const lng = lerp(latLngTL[1], latLngBR[1], x / gridExt);

            const pGlobe = latLngToECEF(lat, lng);
            vec3.transformMat4(pGlobe, pGlobe, norm);

            const mercatorX = mercatorXfromLng(lng);
            const mercatorY = mercatorYfromLat(lat);

            const pMercator = [mercatorX, mercatorY, 0.0];

            boundsArray.emplaceBack(
                pGlobe[0], pGlobe[1], pGlobe[2],
                pMercator[0], pMercator[1], pMercator[2],
                x / gridExt, uvY);
        }
    }

    return boundsArray;
}

function createPoleTriangleVertices(fanSize, tiles, ws, topCap) {
    const arr = new GlobeVertexArray();
    const radius = ws / Math.PI / 2.0;

    // Place the tip
    arr.emplaceBack(0, -radius, 0, 0.5, topCap ? 0.0 : 1.0);

    const startAngle = 0;
    const endAngle = 360.0 / tiles;

    for (let i = 0; i <= fanSize; i++) {
        const angle = lerp(startAngle, endAngle, i / fanSize);
        const p = latLngToECEF(85, angle, radius);

        arr.emplaceBack(p[0], p[1], p[2], 0, 0, 0, i / fanSize, topCap ? 0.0 : 1.0);
    }

    return arr;
}

function prepareBuffersForTileMesh(painter: Painter, tile: Tile, coord: OverscaledTileID) {
    const context = painter.context;
    const id = coord.canonical;
    const tr = painter.transform;
    if (!tile.globeGridBuffer) {
        const gridMesh = createGridVertices(painter, GLOBE_VERTEX_GRID_SIZE, id.x, id.y, id.z);
        tile.globeGridBuffer = context.createVertexBuffer(gridMesh, layout.members, false);
    }

    const tiles = Math.pow(2, coord.canonical.z);
    if (!tile.globePoleBuffer && (coord.canonical.y === 0 || coord.canonical.y === tiles - 1)) {
        const poleMesh = createPoleTriangleVertices(GLOBE_VERTEX_GRID_SIZE, tiles, tr.tileSize * tiles, coord.canonical.y === 0);
        tile.globePoleBuffer = context.createVertexBuffer(poleMesh, layout.members, false);
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

function poleMatrixForTile(id: CanonicalTileID, tr) {
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
    if (id.y === tileDim - 1) {
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
    const skirt = skirtHeight(tr.zoom) * terrain.exaggeration();
    const globeMatrix = tr.calculateGlobeMatrix(tr.worldSize);
    const globeMercatorMatrix = tr.calculateGlobeMercatorMatrix(tr.worldSize);
    const mercCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];
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
            prepareBuffersForTileMesh(painter, tile, coord);

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

            const tiles = Math.pow(2, coord.canonical.z);
            const uniformValues = globeRasterUniformValues(
                tr.projMatrix, posMatrix, globeMercatorMatrix,
                globeToMercatorTransition(tr.zoom),
                mercCenter);

            setShaderMode(shaderMode, isWireframe);

            const gridTileId = new CanonicalTileID(coord.canonical.z, Math.pow(2, coord.canonical.z) / 2, coord.canonical.y);
            elevationOptions = extend(elevationOptions, { elevationTileID: gridTileId });
            terrain.setupElevationDraw(tile, program, elevationOptions);

            painter.prepareDrawProgram(context, program, coord.toUnwrapped());

            program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
                uniformValues, "globe_raster", tile.globeGridBuffer, painter.globeSharedBuffers.gridIndexBuffer, painter.globeSharedBuffers.gridSegments, null, null, null, null);

            // Fill poles by extrapolating adjacent border tiles
            if (coord.canonical.y === 0 || coord.canonical.y === tiles - 1) {
                const poleMatrix = poleMatrixForTile(coord.canonical, tr);

                const poleUniforms = globeRasterUniformValues(
                    tr.projMatrix, poleMatrix, poleMatrix,
                    0.0, mercCenter);

                program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.backCCW,
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
        const mercCenter = [mercatorXfromLng(tr.center.lng), mercatorYfromLat(tr.center.lat)];

        for (const coord of tileIDs) {
            const tile = sourceCache.getTile(coord);
            prepareBuffersForTileMesh(painter, tile, coord);

            const gridTileId = new CanonicalTileID(coord.canonical.z, Math.pow(2, coord.canonical.z) / 2, coord.canonical.y);
            const elevationOptions = { elevationTileID: gridTileId };
            terrain.setupElevationDraw(tile, program, elevationOptions);

            const posMatrix = globeMatrixForTile(coord.canonical, globeMatrix);
            const uniformValues = globeRasterUniformValues(
                tr.projMatrix, posMatrix, globeMercatorMatrix,
                globeToMercatorTransition(tr.zoom), mercCenter);

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
