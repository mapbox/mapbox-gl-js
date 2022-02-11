// @flow
import {
    MAX_MERCATOR_LATITUDE,
    lngFromMercatorX,
    latFromMercatorY,
    mercatorZfromAltitude,
    mercatorXfromLng,
    mercatorYfromLat
} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import {degToRad, smoothstep, clamp} from '../../util/util.js';
import {number as interpolate} from '../../style-spec/util/interpolate.js';
import {mat4, vec3} from 'gl-matrix';
import Point from '@mapbox/point-geometry';
import SegmentVector from '../../data/segment.js';
import {members as globeLayoutAttributes, atmosphereLayout} from '../../terrain/globe_attributes.js';
import {TriangleIndexArray, GlobeVertexArray, LineIndexArray} from '../../data/array_types.js';
import {Aabb} from '../../util/primitives.js';

import type {CanonicalTileID, OverscaledTileID, UnwrappedTileID} from '../../source/tile_id.js';
import type Context from '../../gl/context.js';
import type {Mat4} from 'gl-matrix';
import type IndexBuffer from '../../gl/index_buffer.js';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import type Tile from '../../source/tile.js';
import type Painter from '../../render/painter.js';
import type Transform from '../transform.js';

export const GLOBE_RADIUS = EXTENT / Math.PI / 2.0;
const GLOBE_NORMALIZATION_BIT_RANGE = 15;
const GLOBE_NORMALIZATION_MASK = (1 << (GLOBE_NORMALIZATION_BIT_RANGE - 1)) - 1;
const GLOBE_VERTEX_GRID_SIZE = 64;
const TILE_SIZE = 512;

const GLOBE_MIN = -GLOBE_RADIUS;
const GLOBE_MAX = GLOBE_RADIUS;

const GLOBE_LOW_ZOOM_TILE_AABBS = [
    // z == 0
    new Aabb([GLOBE_MIN, GLOBE_MIN, GLOBE_MIN], [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX]),
    // z == 1
    new Aabb([GLOBE_MIN, GLOBE_MIN, GLOBE_MIN], [0, 0, GLOBE_MAX]), // x=0, y=0
    new Aabb([0, GLOBE_MIN, GLOBE_MIN], [GLOBE_MAX, 0, GLOBE_MAX]), // x=1, y=0
    new Aabb([GLOBE_MIN, 0, GLOBE_MIN], [0, GLOBE_MAX, GLOBE_MAX]), // x=0, y=1
    new Aabb([0, 0, GLOBE_MIN], [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX])  // x=1, y=1
];

export function globeTileBounds(id: CanonicalTileID): Aabb {
    if (id.z <= 1) {
        return GLOBE_LOW_ZOOM_TILE_AABBS[id.z + id.y * 2 + id.x];
    }

    // After zoom 1 surface function is monotonic for all tile patches
    // => it is enough to project corner points
    const [min, max] = globeTileLatLngCorners(id);

    const corners = [
        latLngToECEF(min[0], min[1]),
        latLngToECEF(min[0], max[1]),
        latLngToECEF(max[0], min[1]),
        latLngToECEF(max[0], max[1])
    ];

    const bMin = [GLOBE_MAX, GLOBE_MAX, GLOBE_MAX];
    const bMax = [GLOBE_MIN, GLOBE_MIN, GLOBE_MIN];

    for (const p of corners) {
        bMin[0] = Math.min(bMin[0], p[0]);
        bMin[1] = Math.min(bMin[1], p[1]);
        bMin[2] = Math.min(bMin[2], p[2]);

        bMax[0] = Math.max(bMax[0], p[0]);
        bMax[1] = Math.max(bMax[1], p[1]);
        bMax[2] = Math.max(bMax[2], p[2]);
    }

    return new Aabb(bMin, bMax);
}

function globeTileLatLngCorners(id: CanonicalTileID) {
    const tileScale = 1 << id.z;
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

function csLatLngToECEF(cosLat: number, sinLat: number, lng: number, radius: number = GLOBE_RADIUS): Array<number> {
    lng = degToRad(lng);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = cosLat * Math.sin(lng) * radius;
    const sy = -sinLat * radius;
    const sz = cosLat * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

export function latLngToECEF(lat: number, lng: number, radius?: number): Array<number> {
    return csLatLngToECEF(Math.cos(degToRad(lat)), Math.sin(degToRad(lat)), lng, radius);
}

export function globeECEFOrigin(tileMatrix: Mat4, id: UnwrappedTileID): [number, number, number] {
    const origin = [0, 0, 0];
    const bounds = globeTileBounds(id.canonical);
    const normalizationMatrix = globeNormalizeECEF(bounds);
    vec3.transformMat4(origin, origin, normalizationMatrix);
    vec3.transformMat4(origin, origin, tileMatrix);
    return origin;
}

export function globeECEFNormalizationScale(bounds: Aabb): number {
    const maxExt = Math.max(...vec3.sub([], bounds.max, bounds.min));
    return GLOBE_NORMALIZATION_MASK / maxExt;
}

export function globeNormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));
    const scale = globeECEFNormalizationScale(bounds);
    mat4.scale(m, m, [scale, scale, scale]);
    mat4.translate(m, m, vec3.negate([], bounds.min));
    return m;
}

export function globeDenormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));
    const scale = 1.0 / globeECEFNormalizationScale(bounds);
    mat4.translate(m, m, bounds.min);
    mat4.scale(m, m, [scale, scale, scale]);
    return m;
}

export function globeECEFUnitsToPixelScale(worldSize: number): number {
    const localRadius = EXTENT / (2.0 * Math.PI);
    const wsRadius = worldSize / (2.0 * Math.PI);
    return wsRadius / localRadius;
}

export function globePixelsToTileUnits(zoom: number, id: CanonicalTileID): number {
    const ecefPerPixel = EXTENT / (TILE_SIZE * Math.pow(2, zoom));
    const normCoeff = globeECEFNormalizationScale(globeTileBounds(id));

    return ecefPerPixel * normCoeff;
}

export function calculateGlobeMatrix(tr: Transform, worldSize: number, offset?: [number, number]): Float64Array {
    const wsRadius = worldSize / (2.0 * Math.PI);
    const scale = globeECEFUnitsToPixelScale(worldSize);

    if (!offset) {
        const lat = clamp(tr.center.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
        const lng = tr.center.lng;

        offset = [
            mercatorXfromLng(lng) * worldSize,
            mercatorYfromLat(lat) * worldSize
        ];
    }

    // transform the globe from reference coordinate space to world space
    const posMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(posMatrix, posMatrix, [offset[0], offset[1], -wsRadius]);
    mat4.scale(posMatrix, posMatrix, [scale, scale, scale]);
    mat4.rotateX(posMatrix, posMatrix, degToRad(-tr._center.lat));
    mat4.rotateY(posMatrix, posMatrix, degToRad(-tr._center.lng));

    return posMatrix;
}

export function calculateGlobeMercatorMatrix(tr: Transform): Float32Array {
    const worldSize = tr.worldSize;
    const lat = clamp(tr.center.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    const point = new Point(
        mercatorXfromLng(tr.center.lng) * worldSize,
        mercatorYfromLat(lat) * worldSize);

    const mercatorZ = mercatorZfromAltitude(1, tr.center.lat) * worldSize;
    const projectionScaler = mercatorZ / tr.pixelsPerMeter;
    const zScale = tr.pixelsPerMeter;
    const ws = worldSize / projectionScaler;

    const posMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(posMatrix, posMatrix, [point.x, point.y, 0.0]);
    mat4.scale(posMatrix, posMatrix, [ws, ws, zScale]);

    return Float32Array.from(posMatrix);
}

export const GLOBE_ZOOM_THRESHOLD_MIN = 5;
export const GLOBE_ZOOM_THRESHOLD_MAX = 6;

export function globeToMercatorTransition(zoom: number): number {
    return smoothstep(GLOBE_ZOOM_THRESHOLD_MIN, GLOBE_ZOOM_THRESHOLD_MAX, zoom);
}

export function globeVertexBufferForTileMesh(painter: Painter, tile: Tile, coord: OverscaledTileID): VertexBuffer {
    const context = painter.context;
    const id = coord.canonical;
    let gridBuffer = tile.globeGridBuffer;

    if (!gridBuffer) {
        const gridMesh = GlobeSharedBuffers.createGridVertices(id);
        gridBuffer = tile.globeGridBuffer = context.createVertexBuffer(gridMesh, globeLayoutAttributes, false);
    }

    return gridBuffer;
}

export function globeMatrixForTile(id: CanonicalTileID, globeMatrix: Float64Array): Float32Array {
    const decode = globeDenormalizeECEF(globeTileBounds(id));
    return mat4.mul(mat4.create(), globeMatrix, decode);
}

export function globePoleMatrixForTile(id: CanonicalTileID, isTopCap: boolean, tr: Transform): Float32Array {
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
    if (!isTopCap) {
        mat4.scale(poleMatrix, poleMatrix, [1, -1, 1]);
    }

    return Float32Array.from(poleMatrix);
}

const POLE_RAD = degToRad(85.0);
const POLE_COS = Math.cos(POLE_RAD);
const POLE_SIN = Math.sin(POLE_RAD);

export class GlobeSharedBuffers {
    poleNorthVertexBuffer: VertexBuffer;
    poleSouthVertexBuffer: VertexBuffer;
    poleIndexBuffer: IndexBuffer;
    poleSegments: Array<SegmentVector>;

    gridIndexBuffer: IndexBuffer;
    gridSegments: SegmentVector;

    atmosphereVertexBuffer: VertexBuffer;
    atmosphereIndexBuffer: IndexBuffer;
    atmosphereSegments: SegmentVector;

    wireframeIndexBuffer: IndexBuffer;
    wireframeSegments: SegmentVector;

    constructor(context: Context) {
        this._createGrid(context);
        this._createPoles(context);
        this._createAtmosphere(context);
    }

    destroy() {
        this.poleIndexBuffer.destroy();
        this.gridIndexBuffer.destroy();
        this.poleNorthVertexBuffer.destroy();
        this.poleSouthVertexBuffer.destroy();
        for (const segments of this.poleSegments) segments.destroy();
        this.gridSegments.destroy();
        this.atmosphereVertexBuffer.destroy();
        this.atmosphereIndexBuffer.destroy();
        this.atmosphereSegments.destroy();

        if (this.wireframeIndexBuffer) {
            this.wireframeIndexBuffer.destroy();
            this.wireframeSegments.destroy();
        }
    }

    _createGrid(context: Context) {
        const gridIndices = new TriangleIndexArray();
        const quadExt = GLOBE_VERTEX_GRID_SIZE;
        const vertexExt = quadExt + 1;

        for (let j = 0; j < quadExt; j++) {
            for (let i = 0; i < quadExt; i++) {
                const index = j * vertexExt + i;
                gridIndices.emplaceBack(index + 1, index, index + vertexExt);
                gridIndices.emplaceBack(index + vertexExt, index + vertexExt + 1, index + 1);
            }
        }
        this.gridIndexBuffer = context.createIndexBuffer(gridIndices, true);

        const gridPrimitives = GLOBE_VERTEX_GRID_SIZE * GLOBE_VERTEX_GRID_SIZE * 2;
        const gridVertices = (GLOBE_VERTEX_GRID_SIZE + 1) * (GLOBE_VERTEX_GRID_SIZE + 1);
        this.gridSegments = SegmentVector.simpleSegment(0, 0, gridVertices, gridPrimitives);
    }

    _createPoles(context: Context) {
        const poleIndices = new TriangleIndexArray();
        for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
            poleIndices.emplaceBack(0, i + 1, i + 2);
        }
        this.poleIndexBuffer = context.createIndexBuffer(poleIndices, true);

        const northVertices = new GlobeVertexArray();
        const southVertices = new GlobeVertexArray();
        const vertices = [northVertices, southVertices];

        const polePrimitives = GLOBE_VERTEX_GRID_SIZE;
        const poleVertices = GLOBE_VERTEX_GRID_SIZE + 2;
        this.poleSegments = [];

        for (let zoom = 0, offset = 0; zoom < GLOBE_ZOOM_THRESHOLD_MIN; zoom++) {
            const tiles = 1 << zoom;
            const radius = tiles * TILE_SIZE / Math.PI / 2.0;
            const endAngle = 360.0 / tiles;

            for (let z = 0; z <= 1; z++) {
                vertices[z].emplaceBack(0, -radius, 0, 0, 0, 0.5, z); // place the tip
            }

            for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
                const uvX = i / GLOBE_VERTEX_GRID_SIZE;
                const angle = interpolate(0, endAngle, uvX);
                const [gx, gy, gz] = csLatLngToECEF(POLE_COS, POLE_SIN, angle, radius);
                for (let z = 0; z <= 1; z++) {
                    vertices[z].emplaceBack(gx, gy, gz, 0, 0, uvX, z);
                }
            }

            this.poleSegments.push(SegmentVector.simpleSegment(offset, 0, poleVertices, polePrimitives));
            offset += poleVertices;
        }

        this.poleNorthVertexBuffer = context.createVertexBuffer(northVertices, globeLayoutAttributes, false);
        this.poleSouthVertexBuffer = context.createVertexBuffer(southVertices, globeLayoutAttributes, false);
    }

    _createAtmosphere(context: Context) {
        const atmosphereVertices = new GlobeVertexArray();
        atmosphereVertices.emplaceBack(-1, 1, 1, 0, 0, 0, 0);
        atmosphereVertices.emplaceBack(1, 1, 1, 0, 0, 1, 0);
        atmosphereVertices.emplaceBack(1, -1, 1, 0, 0, 1, 1);
        atmosphereVertices.emplaceBack(-1, -1, 1, 0, 0, 0, 1);

        const atmosphereTriangles = new TriangleIndexArray();
        atmosphereTriangles.emplaceBack(0, 1, 2);
        atmosphereTriangles.emplaceBack(2, 3, 0);

        this.atmosphereVertexBuffer = context.createVertexBuffer(atmosphereVertices, atmosphereLayout.members);
        this.atmosphereIndexBuffer = context.createIndexBuffer(atmosphereTriangles);
        this.atmosphereSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    static createGridVertices(id: CanonicalTileID): GlobeVertexArray {
        const tiles = 1 << id.z;
        const [latLngTL, latLngBR] = globeTileLatLngCorners(id);
        const norm = globeNormalizeECEF(globeTileBounds(id));
        const vertexExt = GLOBE_VERTEX_GRID_SIZE + 1;

        const boundsArray = new GlobeVertexArray();
        boundsArray.reserve(GLOBE_VERTEX_GRID_SIZE * GLOBE_VERTEX_GRID_SIZE);

        for (let y = 0; y < vertexExt; y++) {
            const lat = interpolate(latLngTL[0], latLngBR[0], y / GLOBE_VERTEX_GRID_SIZE);
            const mercatorY = mercatorYfromLat(lat);
            const uvY = (mercatorY * tiles) - id.y;
            const sinLat = Math.sin(degToRad(lat));
            const cosLat = Math.cos(degToRad(lat));

            for (let x = 0; x < vertexExt; x++) {
                const uvX = x / GLOBE_VERTEX_GRID_SIZE;
                const lng = interpolate(latLngTL[1], latLngBR[1], uvX);
                const mercatorX = mercatorXfromLng(lng);

                const pGlobe = csLatLngToECEF(cosLat, sinLat, lng);
                const [px, py, pz] = vec3.transformMat4(pGlobe, pGlobe, norm);

                boundsArray.emplaceBack(px, py, pz, mercatorX, mercatorY, uvX, uvY);
            }
        }

        return boundsArray;
    }

    getWirefameBuffer(context: Context): [IndexBuffer, SegmentVector] {
        if (!this.wireframeSegments) {
            const wireframeIndices = new LineIndexArray();
            const quadExt = GLOBE_VERTEX_GRID_SIZE;
            const vertexExt = quadExt + 1;

            for (let j = 0; j < quadExt; j++) {
                for (let i = 0; i < quadExt; i++) {
                    const index = j * vertexExt + i;
                    wireframeIndices.emplaceBack(index, index + 1);
                    wireframeIndices.emplaceBack(index, index + vertexExt);
                    wireframeIndices.emplaceBack(index, index + vertexExt + 1);
                }
            }
            this.wireframeIndexBuffer = context.createIndexBuffer(wireframeIndices);
            this.wireframeSegments = SegmentVector.simpleSegment(0, 0, quadExt * quadExt, wireframeIndices.length);
        }
        return [this.wireframeIndexBuffer, this.wireframeSegments];
    }

    getPoleBuffersForTile(zoom: number, isTopCap: boolean): [VertexBuffer, ?SegmentVector] {
        const vertexBuffer = isTopCap ? this.poleNorthVertexBuffer : this.poleSouthVertexBuffer;
        const segments = zoom >= 0 && zoom < this.poleSegments.length ? this.poleSegments[zoom] : null;
        return [vertexBuffer, segments];
    }
}
