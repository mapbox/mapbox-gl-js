// @flow
// logic for generating non-Mercator adaptive raster tile reprojection meshes with MARTINI

import tileTransform from '../geo/projection/tile_transform.js';
import EXTENT from '../style-spec/data/extent.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';
import {TileBoundsArray, TriangleIndexArray} from '../data/array_types.js';

import type {CanonicalTileID} from './tile_id.js';
import type Projection from '../geo/projection/projection.js';

const meshSize = 32;
const gridSize = meshSize + 1;

const numTriangles = meshSize * meshSize * 2 - 2;
const numParentTriangles = numTriangles - meshSize * meshSize;

const coords = new Uint16Array(numTriangles * 4);

// precalculate RTIN triangle coordinates
for (let i = 0; i < numTriangles; i++) {
    let id = i + 2;
    let ax = 0, ay = 0, bx = 0, by = 0, cx = 0, cy = 0;

    if (id & 1) {
        bx = by = cx = meshSize; // bottom-left triangle

    } else {
        ax = ay = cy = meshSize; // top-right triangle
    }

    while ((id >>= 1) > 1) {
        const mx = (ax + bx) >> 1;
        const my = (ay + by) >> 1;

        if (id & 1) { // left half
            bx = ax; by = ay;
            ax = cx; ay = cy;

        } else { // right half
            ax = bx; ay = by;
            bx = cx; by = cy;
        }

        cx = mx; cy = my;
    }

    const k = i * 4;
    coords[k + 0] = ax;
    coords[k + 1] = ay;
    coords[k + 2] = bx;
    coords[k + 3] = by;
}

// temporary arrays we'll reuse for MARTINI mesh code
const reprojectedCoords = new Uint16Array(gridSize * gridSize * 2);
const used = new Uint8Array(gridSize * gridSize);
const indexMap = new Uint16Array(gridSize * gridSize);

type TileMesh = {
    vertices: TileBoundsArray,
    indices: TriangleIndexArray
};

// There can be visible seams between neighbouring tiles because of precision issues
// and resampling differences. Adding a bit of padding around the edges of tiles hides
// most of these issues.
const commonRasterTileSize = 256;
const paddingSize = meshSize / commonRasterTileSize / 4;
function seamPadding(n: number) {
    if (n === 0) return -paddingSize;
    else if (n === gridSize - 1) return paddingSize;
    else return 0;
}

export default function getTileMesh(canonical: CanonicalTileID, projection: Projection): TileMesh {
    const cs = tileTransform(canonical, projection);
    const z2 = Math.pow(2, canonical.z);

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const lng = lngFromMercatorX((canonical.x + (x + seamPadding(x)) / meshSize) / z2);
            const lat = latFromMercatorY((canonical.y + (y + seamPadding(y)) / meshSize) / z2);
            const p = projection.project(lng, lat);
            const k = y * gridSize + x;
            reprojectedCoords[2 * k + 0] = Math.round((p.x * cs.scale - cs.x) * EXTENT);
            reprojectedCoords[2 * k + 1] = Math.round((p.y * cs.scale - cs.y) * EXTENT);
        }
    }

    used.fill(0);
    indexMap.fill(0);

    // iterate over all possible triangles, starting from the smallest level
    for (let i = numTriangles - 1; i >= 0; i--) {
        const k = i * 4;
        const ax = coords[k + 0];
        const ay = coords[k + 1];
        const bx = coords[k + 2];
        const by = coords[k + 3];
        const mx = (ax + bx) >> 1;
        const my = (ay + by) >> 1;
        const cx = mx + my - ay;
        const cy = my + ax - mx;

        const aIndex = ay * gridSize + ax;
        const bIndex = by * gridSize + bx;
        const mIndex = my * gridSize + mx;

        // calculate error in the middle of the long edge of the triangle
        const rax = reprojectedCoords[2 * aIndex + 0];
        const ray = reprojectedCoords[2 * aIndex + 1];
        const rbx = reprojectedCoords[2 * bIndex + 0];
        const rby = reprojectedCoords[2 * bIndex + 1];
        const rmx = reprojectedCoords[2 * mIndex + 0];
        const rmy = reprojectedCoords[2 * mIndex + 1];

        // raster tiles are typically 512px, and we use 1px as an error threshold; 8192 / 512 = 16
        const isUsed = Math.hypot((rax + rbx) / 2 - rmx, (ray + rby) / 2 - rmy) >= 16;

        used[mIndex] = used[mIndex] || (isUsed ? 1 : 0);

        if (i < numParentTriangles) { // bigger triangles; accumulate error with children
            const leftChildIndex = ((ay + cy) >> 1) * gridSize + ((ax + cx) >> 1);
            const rightChildIndex = ((by + cy) >> 1) * gridSize + ((bx + cx) >> 1);
            used[mIndex] = used[mIndex] || used[leftChildIndex] || used[rightChildIndex];
        }
    }

    const vertices = new TileBoundsArray();
    const indices = new TriangleIndexArray();

    let numVertices = 0;

    function addVertex(x: number, y: number) {
        const k = y * gridSize + x;

        if (indexMap[k] === 0) {
            vertices.emplaceBack(
                reprojectedCoords[2 * k + 0],
                reprojectedCoords[2 * k + 1],
                x * EXTENT / meshSize,
                y * EXTENT / meshSize);

            // save new vertex index so that we can reuse it
            indexMap[k] = ++numVertices;
        }

        return indexMap[k] - 1;
    }

    function addTriangles(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
        const mx = (ax + bx) >> 1;
        const my = (ay + by) >> 1;

        if (Math.abs(ax - cx) + Math.abs(ay - cy) > 1 && used[my * gridSize + mx]) {
            // triangle doesn't approximate the surface well enough; drill down further
            addTriangles(cx, cy, ax, ay, mx, my);
            addTriangles(bx, by, cx, cy, mx, my);

        } else {
            const ai = addVertex(ax, ay);
            const bi = addVertex(bx, by);
            const ci = addVertex(cx, cy);
            indices.emplaceBack(ai, bi, ci);
        }
    }

    addTriangles(0, 0, meshSize, meshSize, meshSize, 0);
    addTriangles(meshSize, meshSize, 0, 0, 0, meshSize);

    return {vertices, indices};
}
