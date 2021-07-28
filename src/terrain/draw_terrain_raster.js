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
import {easeCubicInOut} from '../util/util.js';
import EXTENT from '../data/extent.js';
import {warnOnce, clamp, degToRad} from '../util/util.js';
import {RasterBoundsArray, GlobeVertexArray, TriangleIndexArray} from '../data/array_types.js';
import {lngFromMercatorX, latFromMercatorY, mercatorYfromLat, mercatorZfromAltitude} from '../geo/mercator_coordinate.js';
import {createLayout} from '../util/struct_array.js';
import SegmentVector from '../data/segment.js';

import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';
import { array } from '../style-spec/expression/types.js';
import {tileLatLngCorners, latLngToECEF} from '../geo/projection/globe.js'

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
    { type: 'Float32', name: 'a_uv', components: 2 }
]);

const lerp = (a, b, t) => a * (1 - t) + b * t;

function calculateGridKey(y, z) {
    return (1 << Math.min(z, 22)) + y;
}

function createGridVertices(count: number, sz, sy, ws): any {
    const tiles = Math.pow(2, sz);
    const [latLngTL, latLngBR]= tileLatLngCorners(new CanonicalTileID(sz, tiles / 2, sy));
    const radius = ws / Math.PI / 2.0;
    const boundsArray = new GlobeVertexArray();

    const gridExt = count;
    const vertexExt = gridExt + 1;
    boundsArray.reserve(count * count);

    for (let y = 0; y < vertexExt; y++) {
        const lat = lerp(latLngTL[0], latLngBR[0], y / gridExt);
        const mercY = clamp(mercatorYfromLat(lat), 0, 1);
        const uvY = (mercY * tiles) - sy;
        for (let x = 0; x < vertexExt; x++) {
            const lng = lerp(latLngTL[1], latLngBR[1], x / gridExt);

            const p = latLngToECEF(lat, lng, radius);
            boundsArray.emplaceBack(p[0], p[1], p[2], x / gridExt, uvY);
        }
    }

    return boundsArray;
}

function createFlatVertices(count): any {
    const boundsArray = new RasterBoundsArray();

    const gridExt = count;
    const vertexExt = gridExt + 1;
    boundsArray.reserve(count * count);

    for (let y = 0; y < vertexExt; y++) {
        const uvY = y / gridExt;
        for (let x = 0; x < vertexExt; x++) {
            boundsArray.emplaceBack(x / gridExt * EXTENT, y / gridExt * EXTENT, x / gridExt * EXTENT, y / gridExt * EXTENT);
        }
    }

    return boundsArray;
}

function createGridIndices(count) {
    const indexArray = new TriangleIndexArray();
    const quadExt = count;
    const vertexExt = quadExt + 1;
    const quad = (i, j) => {
        const index = j * vertexExt + i;
        indexArray.emplaceBack(index + 1, index, index + vertexExt);
        indexArray.emplaceBack(index + vertexExt, index + vertexExt + 1, index + 1);
    };
    for (let j = 0; j < quadExt; j++) {
        for (let i = 0; i < quadExt; i++) {
            quad(i, j);
        }
    }
    return indexArray;
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

        arr.emplaceBack(p[0], p[1], p[2], i / fanSize, topCap ? 0.0 : 1.0);
    }

    return arr;
}

function createPoleTriangleIndices(fanSize) {
    const arr = new TriangleIndexArray();
    for (let i = 0; i <= fanSize; i++) {
        arr.emplaceBack(0, i + 1, i + 2);
    }
    return arr;
}

let poleVB;
let poleIB;
let poleSeg;

const gridExt = 128;
const gridMeshDatabase = {};
const gridIndices = createGridIndices(gridExt);
const poleFanDatabase = {};

let flatGridBuffer = null;
let gridBuffer = null;
let gridIndexBuffer = null;
let gridSegments = null;

function drawTerrainRaster(painter: Painter, terrain: Terrain, sourceCache: SourceCache, tileIDs: Array<OverscaledTileID>, now: number) {
    const context = painter.context;
    const gl = context.gl;

    let program, programMode;
    const showWireframe = painter.options.showTerrainWireframe ? SHADER_TERRAIN_WIREFRAME : SHADER_DEFAULT;

    const setShaderMode = (mode, isWireframe) => {
    //    if (programMode === mode)
    //        return;
    //    const modes = [shaderDefines[mode]];
    //    if (isWireframe) modes.push(shaderDefines[showWireframe]);
        program = painter.useProgram('globeRaster');
        //programMode = mode;
    };

    const colorMode = painter.colorModeForRenderPass();
    const depthMode = new DepthMode(gl.LEQUAL, DepthMode.ReadWrite, painter.depthRangeFor3D);
    vertexMorphing.update(now);
    const tr = painter.transform;
    const skirt = skirtHeight(tr.zoom) * terrain.exaggeration();
    const globeMatrix = tr.calculateGlobeMatrix(tr.worldSize);

    const batches = showWireframe ? [false, true] : [false];

    //const transitionLerp = clamp(tr.zoom - 5.0, 0.0, 1.0);// (now % 1000.0) / 1000.0;
    const phase = (now % 10000.0) / 10000.0;
    const transitionLerp = 0.0;// phase <= 0.5 ? phase * 2.0 : 2.0 - 2.0 * phase;
    //const transitionLerp = phase <= 0.5 ? phase * 2.0 : 2.0 - 2.0 * phase;

    batches.forEach(isWireframe => {
        // This code assumes the rendering is batched into mesh terrain and then wireframe
        // terrain (if applicable) so that this is enough to ensure the correct program is
        // set when we switch from one to the other.
        programMode = -1;

        const primitive = isWireframe ? gl.LINES : gl.TRIANGLES;
        const [buffer, segments] = isWireframe ? terrain.getWirefameBuffer() : [terrain.gridIndexBuffer, terrain.gridSegments];

        for (const coord of tileIDs) {
            // check if the grid mesh exists for this tile
            const gridKey = calculateGridKey(coord.canonical.y, coord.canonical.z);
            let gridMesh = null;

            if (gridKey in gridMeshDatabase) {
                gridMesh = gridMeshDatabase[gridKey];
            } else {
                gridMesh = createGridVertices(gridExt, coord.canonical.z, coord.canonical.y, tr.tileSize * Math.pow(2, coord.canonical.z));
                gridMeshDatabase[gridKey] = gridMesh;
            }

            if (!gridBuffer) {
                flatGridBuffer = context.createVertexBuffer(createFlatVertices(gridExt), rasterBoundsAttributes.members, true);
                gridBuffer = context.createVertexBuffer(gridMesh, layout.members, true);
                gridIndexBuffer = context.createIndexBuffer(gridIndices, true);
                gridSegments = SegmentVector.simpleSegment(0, 0, (gridExt + 1) * (gridExt + 1), gridExt * gridExt * 2);
            } else {
                gridBuffer.updateData(gridMesh);
            }

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

            const tileDim = Math.pow(2, coord.canonical.z);
            const xOffset = coord.canonical.x - tileDim / 2;
            const yAngle = xOffset / tileDim * Math.PI * 2.0;

            const posMatrix = mat4.identity(new Float64Array(16));
            const point = tr.point;
            const ws = tr.worldSize;
            const s = tr.worldSize / (tr.tileSize * tileDim);

            mat4.translate(posMatrix, posMatrix, [point.x, point.y, -(ws / Math.PI / 2.0)]);
            mat4.scale(posMatrix, posMatrix, [s, s, s]);
            mat4.rotateX(posMatrix, posMatrix, degToRad(-tr._center.lat));
            mat4.rotateY(posMatrix, posMatrix, degToRad(-tr._center.lng));
            mat4.rotateY(posMatrix, posMatrix, yAngle);

            const projMatrix = mat4.multiply([], tr.projMatrix, posMatrix);
            const mercProjMatrix = mat4.multiply([], tr.projMatrix, tr.calculatePosMatrix(coord.toUnwrapped(), tr.worldSize));

            // Compute normal vectors of corner points. They're used for adding elevation to curved surface
            const tiles = Math.pow(2, coord.canonical.z);
            const normId = new CanonicalTileID(coord.canonical.z, tiles / 2, coord.canonical.y);

            const latLngCorners = tileLatLngCorners(normId);
            const tl = latLngCorners[0];
            const br = latLngCorners[1];
            const tlNorm = latLngToECEF(tl[0], tl[1]);
            const trNorm = latLngToECEF(tl[0], br[1]);
            const brNorm = latLngToECEF(br[0], br[1]);
            const blNorm = latLngToECEF(br[0], tl[1]);

            vec3.normalize(tlNorm, tlNorm);
            vec3.normalize(trNorm, trNorm);
            vec3.normalize(brNorm, brNorm);
            vec3.normalize(blNorm, blNorm);

            // Pixels per meters have to be interpolated for the latitude range
            const ws2 = tr.tileSize * Math.pow(2, coord.canonical.z);
            const topPixelsPerMeter = mercatorZfromAltitude(1, tl[0]) * ws2;
            const bottomPixelsPerMeter = mercatorZfromAltitude(1, br[0]) * ws2;

            const uniformValues = globeRasterUniformValues(projMatrix, mercProjMatrix, transitionLerp, tlNorm, trNorm, brNorm, blNorm, topPixelsPerMeter, bottomPixelsPerMeter);

            setShaderMode(shaderMode, isWireframe);

            terrain.setupElevationDraw(tile, program, elevationOptions);

            painter.prepareDrawProgram(context, program, coord.toUnwrapped());

            program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, "globe_raster", gridBuffer, gridIndexBuffer, gridSegments, null, null, null, flatGridBuffer);

            // Fill poles by extrapolating adjacent border tiles
            if (transitionLerp === 0 && coord.canonical.y === 0 || coord.canonical.y === tiles - 1) {
                // Mesh already exists?
                const key = calculateGridKey(coord.canonical.y, coord.canonical.z);
                let mesh = null;

                if (key in poleFanDatabase) {
                    mesh = poleFanDatabase[key];
                } else {
                    mesh = createPoleTriangleVertices(gridExt, tiles, tr.tileSize * tiles, coord.canonical.y === 0);
                    poleFanDatabase[key] = mesh;
                }

                if (!poleVB) {
                    poleVB = context.createVertexBuffer(mesh, layout.members, true);
                    poleIB = context.createIndexBuffer(createPoleTriangleIndices(gridExt), true);
                    poleSeg = SegmentVector.simpleSegment(0, 0, gridExt + 2, gridExt);
                } else {
                    poleVB.updateData(mesh);
                }
            
                const poleMatrix = mat4.identity(new Float64Array(16));

                mat4.translate(poleMatrix, poleMatrix, [point.x, point.y, -(ws / Math.PI / 2.0)]);
                mat4.scale(poleMatrix, poleMatrix, [s, s, s]);
                mat4.rotateX(poleMatrix, poleMatrix, degToRad(-tr._center.lat));
                mat4.rotateY(poleMatrix, poleMatrix, degToRad(-tr._center.lng));
                mat4.rotateY(poleMatrix, poleMatrix, yAngle);
                if (coord.canonical.y === tiles - 1) {
                    mat4.scale(poleMatrix, poleMatrix, [1, -1, 1]);
                }
                
                mat4.multiply(poleMatrix, tr.projMatrix, poleMatrix);

                const unis = globeRasterUniformValues(
                    poleMatrix,
                    poleMatrix,
                    0.0,
                    [0, -1, 0],
                    [0, -1, 0],
                    [0, -1, 0],
                    [0, -1, 0],
                    mercatorZfromAltitude(1, 85.0) * ws2,
                    mercatorZfromAltitude(1, 85.0) * ws2);

                program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                    unis, "globe_pole_raster", poleVB, poleIB, poleSeg);
            }
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
