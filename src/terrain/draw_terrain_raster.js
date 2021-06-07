// @flow

import {vec4, mat4, mat2, vec3, quat} from 'gl-matrix';
import DepthMode from '../gl/depth_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import {terrainRasterUniformValues} from './terrain_raster_program.js';
import {globeRasterUniformValues} from './globe_raster_program.js';
import {Terrain} from './terrain.js';
import Tile from '../source/tile.js';
import assert from 'assert';
import {easeCubicInOut} from '../util/util.js';
import EXTENT from '../data/extent.js';
import {warnOnce, clamp, degToRad} from '../util/util.js';
import {GlobeVertexArray, TriangleIndexArray} from '../data/array_types.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';
import {createLayout} from '../util/struct_array.js';
import SegmentVector from '../data/segment.js';

import type Painter from '../render/painter.js';
import type SourceCache from '../source/source_cache.js';
import {OverscaledTileID, CanonicalTileID} from '../source/tile_id.js';
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

function calculateGridKey(y, z) {
    return (1 << Math.min(z, 22)) + y;
}

function tileLatLngCorners(id: CanonicalTileID) {
    const tileScale = Math.pow(2, id.z);
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

function latLngToECEF(lat, lng, r) {
    lat = degToRad(lat);
    lng = degToRad(lng);

    const sx = Math.cos(lat) * Math.sin(lng) * r;
    const sy = -Math.sin(lat) * r;
    const sz = Math.cos(lat) * Math.cos(lng) * r;

    return [sx, sy, sz];
}

function createGridVertices(count: number, z, y, ws): any {
    const tiles = Math.pow(2, z);
    const [latLngTL, latLngBR]= tileLatLngCorners(new CanonicalTileID(z, tiles / 2, y));
    const lerp = (a, b, t) => a * (1 - t) + b * t;
    const radius = ws / Math.PI / 2.0;
    const boundsArray = new GlobeVertexArray();

    const gridExt = count;
    const vertexExt = gridExt + 1;
    boundsArray.reserve(count * count);

    for (let y = 0; y < vertexExt; y++) {
        for (let x = 0; x < vertexExt; x++) {
            const lat = lerp(latLngTL[0], latLngBR[0], y / gridExt);
            const lng = lerp(latLngTL[1], latLngBR[1], x / gridExt);

            const p = latLngToECEF(lat, lng, radius);
            boundsArray.emplaceBack(p[0], p[1], p[2], x / gridExt, y / gridExt);
        }
    }

    return boundsArray;

    // // Around the grid, add one more row/column padding for "skirt".
    // //const indexArray = new TriangleIndexArray();
    // const size = count + 2;
    // //indexArray.reserve((size - 1) * (size - 1) * 2);
    // const step = EXTENT / (count - 1);
    // const gridBound = EXTENT + step / 2;
    // const bound = gridBound + step;

    // // Skirt offset of 0x5FFF is chosen randomly to encode boolean value (skirt
    // // on/off) with x position (max value EXTENT = 4096) to 16-bit signed integer.
    // //const skirtOffset = 24575; // 0x5FFF
    // for (let y = 0; y < gridBound; y += step) {
    //     for (let x = 0; x < gridBound; x += step) {
    //         //const offset = (x < 0 || x > gridBound || y < 0 || y > gridBound) ? skirtOffset : 0;
    //         const xi = clamp(Math.round(x), 0, EXTENT);
    //         const yi = clamp(Math.round(y), 0, EXTENT);
    //         boundsArray.emplaceBack(xi/* + offset*/, yi, xi, yi);
    //     }
    // }
    
    // return boundsArray;
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

const gridExt = 1;
const gridMeshDatabase = {};
const gridIndices = createGridIndices(gridExt);

let gridBuffer = null;// context.createVertexBuffer(triangleGridArray, rasterBoundsAttributes.members);
let gridIndexBuffer = null;// context.createIndexBuffer(triangleGridIndices);
let gridSegments = null;// SegmentVector.simpleSegment(0, 0, triangleGridArray.length, skirtIndicesOffset);

const layout = createLayout([
    { type: 'Float32', name: 'a_pos', components: 3 },
    { type: 'Float32', name: 'a_uv', components: 2 }
]);

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

    const batches = showWireframe ? [false, true] : [false];

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
                gridBuffer = context.createVertexBuffer(gridMesh, layout.members, true);
                gridIndexBuffer = context.createIndexBuffer(gridIndices, true);
                gridSegments = SegmentVector.simpleSegment(0, 0, (gridExt + 1) * (gridExt + 1), gridExt * gridExt * 2);
            } else {
                gridBuffer.updateData(gridMesh);
                //console.log(gridMesh.length);
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
            const cameraPos = tr._camera.position;
            const ws = tr.worldSize;
            const s = tr.worldSize / (tr.tileSize * tileDim);
            mat4.translate(posMatrix, posMatrix, [cameraPos[0] * ws, cameraPos[1] * ws, 0.0]);
            mat4.translate(posMatrix, posMatrix, [0, 0, -(ws / Math.PI / 2.0)]);
            mat4.scale(posMatrix, posMatrix, [s, s, s]);
            mat4.rotateX(posMatrix, posMatrix, degToRad(-tr._center.lat));
            mat4.rotateY(posMatrix, posMatrix, degToRad(-tr._center.lng));
            mat4.rotateY(posMatrix, posMatrix, yAngle);

            const projMatrix = mat4.multiply([], tr.projMatrix, posMatrix);

            //const test = vec4.transformMat4([], [0, 0, ws / Math.PI / 2.0, 1], projMatrix);

            //const uniformValues = terrainRasterUniformValues(coord.projMatrix, isEdgeTile(coord.canonical, tr.renderWorldCopies) ? skirt / 10 : skirt);
            const uniformValues = globeRasterUniformValues(/*coord.*/projMatrix);

            setShaderMode(shaderMode, isWireframe);

            terrain.setupElevationDraw(tile, program, elevationOptions);

            painter.prepareDrawProgram(context, program, coord.toUnwrapped());

            program.draw(context, primitive, depthMode, stencilMode, colorMode, CullFaceMode.disabled,
                uniformValues, "globe_raster", gridBuffer, gridIndexBuffer, gridSegments);//  terrain.gridBuffer, buffer, segments);
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
