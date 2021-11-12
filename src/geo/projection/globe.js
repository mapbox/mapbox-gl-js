// @flow
import {mat4, vec3} from 'gl-matrix';
import {Aabb, Ray} from '../../util/primitives.js';
import EXTENT from '../../data/extent.js';
import LngLat from '../lng_lat.js';
import {degToRad, smoothstep, clamp} from '../../util/util.js';
import {
    MAX_MERCATOR_LATITUDE,
    lngFromMercatorX,
    latFromMercatorY,
    mercatorZfromAltitude,
    mercatorXfromLng,
    mercatorYfromLat
} from '../mercator_coordinate.js';
import {CanonicalTileID, OverscaledTileID} from '../../source/tile_id.js';
import Context from '../../gl/context.js';
import Tile from '../../source/tile.js';
import IndexBuffer from '../../gl/index_buffer.js';
import type Painter from '../../render/painter.js';
import SegmentVector from '../../data/segment.js';
import Point from '@mapbox/point-geometry';
import type VertexBuffer from '../../gl/vertex_buffer.js';
import {TriangleIndexArray, GlobeVertexArray, LineIndexArray} from '../../data/array_types.js';
import type Transform from '../transform.js';
import {members as globeLayoutAttributes, atmosphereLayout} from '../../terrain/globe_attributes.js';
import GlobeTileTransform from './globe_tile_transform.js';
import {furthestPixelDistanceOnSphere} from './far_z.js';

export const NORMALIZATION_BIT_RANGE = 15;
export const GLOBE_RADIUS = EXTENT / Math.PI / 2.0;
const GLOBE_VERTEX_GRID_SIZE = 64;

export default {
    name: 'globe',
    requiresDraping: true,
    supportsWorldCopies: false,
    zAxisUnit: "pixels",

    project() {
        return {x: 0, y: 0, z: 0};
    },

    unproject(x: number, y: number) {
        const lng = lngFromMercatorX(x);
        const lat = latFromMercatorY(y);
        return new LngLat(lng, lat);
    },

    projectTilePoint(x: number, y: number, id: CanonicalTileID): {x: number, y: number, z: number} {
        const tiles = Math.pow(2.0, id.z);
        const mx = (x / EXTENT + id.x) / tiles;
        const my = (y / EXTENT + id.y) / tiles;
        const lat = latFromMercatorY(my);
        const lng = lngFromMercatorX(mx);
        const pos = latLngToECEF(lat, lng);

        // eslint-disable-next-line no-warning-comments
        // TODO: cached matrices!
        const bounds = globeTileBounds(id);
        const normalizationMatrix = normalizeECEF(bounds);
        vec3.transformMat4(pos, pos, normalizationMatrix);

        return {x: pos[0], y: pos[1], z: pos[2]};
    },

    locationPoint(tr: Transform, lngLat: LngLat): Point {
        const pos = latLngToECEF(lngLat.lat, lngLat.lng);
        const up = vec3.normalize([], pos);

        const elevation = tr.elevation ?
            tr.elevation.getAtPointOrZero(tr.locationCoordinate(lngLat), tr._centerAltitude) :
            tr._centerAltitude;

        const upScale = mercatorZfromAltitude(1, 0) * EXTENT * elevation;
        vec3.scaleAndAdd(pos, pos, up, upScale);
        const matrix = calculateGlobeMatrix(tr, tr.worldSize);
        mat4.multiply(matrix, tr.pixelMatrix, matrix);
        vec3.transformMat4(pos, pos, matrix);

        return new Point(pos[0], pos[1]);
    },

    pixelsPerMeter(lat: number, worldSize: number) {
        return mercatorZfromAltitude(1, 0) * worldSize;
    },

    createTileTransform(tr: Transform, worldSize: number): Object {
        return new GlobeTileTransform(tr, worldSize);
    },

    farthestPixelDistance(tr: Transform): number {
        const pixelsPerMeter = this.pixelsPerMeter(tr.center.lat, tr.worldSize);
        return furthestPixelDistanceOnSphere(tr, pixelsPerMeter);
    }
};

export function globeTileBounds(id: CanonicalTileID): Aabb {
    const z = id.z;

    const mn = -GLOBE_RADIUS;
    const mx = GLOBE_RADIUS;

    if (z === 0) {
        return new Aabb([mn, mn, mn], [mx, mx, mx]);
    } else if (z === 1) {
        if (id.x === 0 && id.y === 0) {
            return new Aabb([mn, mn, mn], [0, 0, mx]);
        } else if (id.x === 1 && id.y === 0) {
            return new Aabb([0, mn, mn], [mx, 0, mx]);
        } else if (id.x === 0 && id.y === 1) {
            return new Aabb([mn, 0, mn], [0, mx, mx]);
        } else if (id.x === 1 && id.y === 1) {
            return new Aabb([0, 0, mn], [mx, mx, mx]);
        }
    }

    // After zoom 1 surface function is monotonic for all tile patches
    // => it is enough to project corner points
    const [min, max] = globeTileLatLngCorners(id);

    const corners = [
        latLngToECEF(min[0], min[1], GLOBE_RADIUS),
        latLngToECEF(min[0], max[1], GLOBE_RADIUS),
        latLngToECEF(max[0], min[1], GLOBE_RADIUS),
        latLngToECEF(max[0], max[1], GLOBE_RADIUS)
    ];

    const bMin = [mx, mx, mx];
    const bMax = [mn, mn, mn];

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

export function globeTileLatLngCorners(id: CanonicalTileID) {
    const tileScale = Math.pow(2, id.z);
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

export function latLngToECEF(lat: number, lng: number, radius: ?number): Array<number> {
    lat = degToRad(lat);
    lng = degToRad(lng);

    if (!radius) {
        radius = GLOBE_RADIUS;
    }

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = Math.cos(lat) * Math.sin(lng) * radius;
    const sy = -Math.sin(lat) * radius;
    const sz = Math.cos(lat) * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

function normalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));

    const maxExtInv = 1.0 / Math.max(...vec3.sub([], bounds.max, bounds.min));
    const st = (1 << (NORMALIZATION_BIT_RANGE - 1)) - 1;

    mat4.scale(m, m, [st, st, st]);
    mat4.scale(m, m, [maxExtInv, maxExtInv, maxExtInv]);
    mat4.translate(m, m, vec3.negate([], bounds.min));

    return m;
}

export function denormalizeECEF(bounds: Aabb): Float64Array {
    const m = mat4.identity(new Float64Array(16));

    const maxExt = Math.max(...vec3.sub([], bounds.max, bounds.min));

    // Denormalize points to the correct range
    const st = 1.0 / ((1 << (NORMALIZATION_BIT_RANGE - 1)) - 1);
    mat4.translate(m, m, bounds.min);
    mat4.scale(m, m, [maxExt, maxExt, maxExt]);
    mat4.scale(m, m, [st, st, st]);

    return m;
}

export function calculateGlobeMatrix(tr: Transform, worldSize: number): mat4 {
    const localRadius = EXTENT / (2.0 * Math.PI);
    const wsRadius = worldSize / (2.0 * Math.PI);
    const s = wsRadius / localRadius;

    const lat = clamp(tr.center.lat, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
    const point = new Point(
        mercatorXfromLng(tr.center.lng) * worldSize,
        mercatorYfromLat(lat) * worldSize);

    // transform the globe from reference coordinate space to world space
    const posMatrix = mat4.identity(new Float64Array(16));
    mat4.translate(posMatrix, posMatrix, [point.x, point.y, -wsRadius]);
    mat4.scale(posMatrix, posMatrix, [s, s, s]);
    mat4.rotateX(posMatrix, posMatrix, degToRad(-tr._center.lat));
    mat4.rotateY(posMatrix, posMatrix, degToRad(-tr._center.lng));

    return posMatrix;
}

export function calculateGlobeMercatorMatrix(tr: Transform): mat4 {
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

    return posMatrix;
}

export const GLOBE_ZOOM_THRESHOLD_MIN = 5;
export const GLOBE_ZOOM_THRESHOLD_MAX = 6;

export function globeToMercatorTransition(zoom: number): number {
    return smoothstep(GLOBE_ZOOM_THRESHOLD_MIN, GLOBE_ZOOM_THRESHOLD_MAX, zoom);
}

export function globeBuffersForTileMesh(painter: Painter, tile: Tile, coord: OverscaledTileID, tiles: number): [VertexBuffer, VertexBuffer] {
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

export function globeMatrixForTile(id: CanonicalTileID, globeMatrix: mat4) {
    const gridTileId = new CanonicalTileID(id.z, Math.pow(2, id.z) / 2, id.y);
    const bounds = globeTileBounds(gridTileId);
    const decode = denormalizeECEF(bounds);
    const posMatrix = mat4.clone(globeMatrix);
    mat4.mul(posMatrix, posMatrix, decode);

    return posMatrix;
}

export function globeUpVectorMatrix(id: CanonicalTileID, tiles: number) {
    // Tile up vectors and can be reused for each tiles on the same x-row.
    // i.e. for each tile id (x, y, z) use pregenerated mesh of (0, y, z).
    // For this reason the up vectors are rotated first by 'yRotation' to
    // place them in the correct longitude location.
    const xOffset = id.x - tiles / 2;
    const yRotation = xOffset / tiles * Math.PI * 2.0;
    return mat4.fromYRotation([], yRotation);
}

export function globePoleMatrixForTile(id: CanonicalTileID, south: boolean, tr: Transform) {
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

export class GlobeSharedBuffers {
    poleIndexBuffer: IndexBuffer;
    poleSegments: SegmentVector;

    gridIndexBuffer: IndexBuffer;
    gridSegments: SegmentVector;

    atmosphereVertexBuffer: VertexBuffer;
    atmosphereIndexBuffer: IndexBuffer;
    atmosphereSegments: SegmentVector;

    wireframeIndexBuffer: IndexBuffer;
    wireframeSegments: SegmentVector;

    constructor(context: Context) {
        const gridIndices = this._createGridIndices();
        this.gridIndexBuffer = context.createIndexBuffer(gridIndices, true);

        const gridPrimitives = GLOBE_VERTEX_GRID_SIZE * GLOBE_VERTEX_GRID_SIZE * 2;
        const gridVertices = (GLOBE_VERTEX_GRID_SIZE + 1) * (GLOBE_VERTEX_GRID_SIZE + 1);
        this.gridSegments = SegmentVector.simpleSegment(0, 0, gridVertices, gridPrimitives);

        const poleIndices = this._createPoleTriangleIndices();
        this.poleIndexBuffer = context.createIndexBuffer(poleIndices, true);

        const polePrimitives = GLOBE_VERTEX_GRID_SIZE;
        const poleVertices = GLOBE_VERTEX_GRID_SIZE + 2;
        this.poleSegments = SegmentVector.simpleSegment(0, 0, poleVertices, polePrimitives);

        const atmosphereVertices = new GlobeVertexArray();
        atmosphereVertices.emplaceBack(-1.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0);
        atmosphereVertices.emplaceBack(1.0, 1.0, 1.0, 0.0, 0.0, 1.0, 0.0);
        atmosphereVertices.emplaceBack(1.0, -1.0, 1.0, 0.0, 0.0, 1.0, 1.0);
        atmosphereVertices.emplaceBack(-1.0, -1.0, 1.0, 0.0, 0.0, 0.0, 1.0);

        const atmosphereTriangles = new TriangleIndexArray();
        atmosphereTriangles.emplaceBack(0, 1, 2);
        atmosphereTriangles.emplaceBack(2, 3, 0);

        this.atmosphereVertexBuffer = context.createVertexBuffer(atmosphereVertices, atmosphereLayout.members);
        this.atmosphereIndexBuffer = context.createIndexBuffer(atmosphereTriangles);
        this.atmosphereSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
    }

    destroy() {
        this.poleIndexBuffer.destroy();
        this.gridIndexBuffer.destroy();
        this.poleSegments.destroy();
        this.gridSegments.destroy();
        this.atmosphereVertexBuffer.destroy();
        this.atmosphereIndexBuffer.destroy();
        this.atmosphereSegments.destroy();

        if (this.wireframeIndexBuffer) {
            this.wireframeIndexBuffer.destroy();
            this.wireframeSegments.destroy();
        }
    }

    static createPoleTriangleVertices(tiles: number, ws: number, isTopCap: boolean): GlobeVertexArray {
        const lerp = (a, b, t) => a * (1 - t) + b * t;
        const arr = new GlobeVertexArray();
        const radius = ws / Math.PI / 2.0;

        // Place the tip
        arr.emplaceBack(0, -radius, 0, 0, 0, 0.5, isTopCap ? 0.0 : 1.0);

        const startAngle = 0;
        const endAngle = 360.0 / tiles;

        for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
            const uvX = i / GLOBE_VERTEX_GRID_SIZE;
            const angle = lerp(startAngle, endAngle, uvX);
            const p = latLngToECEF(85, angle, radius);

            arr.emplaceBack(p[0], p[1], p[2], 0, 0, uvX, isTopCap ? 0.0 : 1.0);
        }

        return arr;
    }

    _createPoleTriangleIndices(): TriangleIndexArray {
        const arr = new TriangleIndexArray();
        for (let i = 0; i <= GLOBE_VERTEX_GRID_SIZE; i++) {
            arr.emplaceBack(0, i + 1, i + 2);
        }
        return arr;
    }

    static createGridVertices(sx: number, sy: number, sz: number): GlobeVertexArray {
        const lerp = (a, b, t) => a * (1 - t) + b * t;
        const tiles = Math.pow(2, sz);
        const gridTileId = new CanonicalTileID(sz, sx, sy);
        const [latLngTL, latLngBR] = globeTileLatLngCorners(gridTileId);
        const boundsArray = new GlobeVertexArray();

        const bounds = globeTileBounds(new CanonicalTileID(sz, tiles / 2, sy));
        const norm = normalizeECEF(bounds);

        const vertexExt = GLOBE_VERTEX_GRID_SIZE + 1;
        boundsArray.reserve(GLOBE_VERTEX_GRID_SIZE * GLOBE_VERTEX_GRID_SIZE);

        for (let y = 0; y < vertexExt; y++) {
            const lat = lerp(latLngTL[0], latLngBR[0], y / GLOBE_VERTEX_GRID_SIZE);
            const mercY = clamp(mercatorYfromLat(lat), 0, 1);
            const uvY = (mercY * tiles) - sy;
            for (let x = 0; x < vertexExt; x++) {
                const uvX = x / GLOBE_VERTEX_GRID_SIZE;
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

    _createGridIndices(): TriangleIndexArray {
        const indexArray = new TriangleIndexArray();
        const quadExt = GLOBE_VERTEX_GRID_SIZE;
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

    getWirefameBuffer(context: Context): [IndexBuffer, SegmentVector] {
        if (!this.wireframeSegments) {
            const wireframeGridIndices = this._createWireframeGrid();
            this.wireframeIndexBuffer = context.createIndexBuffer(wireframeGridIndices);

            const vertexBufferLength = GLOBE_VERTEX_GRID_SIZE * GLOBE_VERTEX_GRID_SIZE;
            this.wireframeSegments = SegmentVector.simpleSegment(0, 0, vertexBufferLength, wireframeGridIndices.length);
        }
        return [this.wireframeIndexBuffer, this.wireframeSegments];
    }

    _createWireframeGrid(): LineIndexArray {
        const indexArray = new LineIndexArray();

        const quadExt = GLOBE_VERTEX_GRID_SIZE;
        const vertexExt = quadExt + 1;

        const quad = (i, j) => {
            const index = j * vertexExt + i;
            indexArray.emplaceBack(index, index + 1);
            indexArray.emplaceBack(index, index + vertexExt);
            indexArray.emplaceBack(index, index + vertexExt + 1);
        };

        for (let j = 0; j < quadExt; j++) {
            for (let i = 0; i < quadExt; i++) {
                quad(i, j);
            }
        }

        return indexArray;
    }
}
