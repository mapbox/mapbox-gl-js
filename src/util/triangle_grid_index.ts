import {triangleIntersectsTriangle} from './intersection_tests';
import Point from "@mapbox/point-geometry";
import {register} from './web_worker_transfer';

/**
 * TriangleGridIndex is a specialized GridIndex data structure optimized
 * for querying potentially intersecting triangles in a 2d plane. Once built,
 * the data structure is immutable.
 *
 * @private
 */
class TriangleGridIndex {
    triangleCount: number;
    min: Point;
    max: Point;
    xScale: number;
    yScale: number;
    cellsX: number;
    cellsY: number;
    // triangles of cell i are payload[cellOffsets[i]..cellOffsets[i + 1]), sorted by index
    cellOffsets: Uint32Array;
    payload: Uint32Array;
    lookup: Uint8Array | null | undefined;

    constructor(vertices: Array<Point>, indices: ArrayLike<number>, cellCount: number, maxCellSize?: number | null) {
        this.triangleCount = indices.length / 3;
        this.min = new Point(0, 0);
        this.max = new Point(0, 0);
        this.xScale = 0;
        this.yScale = 0;
        this.cellsX = 0;
        this.cellsY = 0;
        this.cellOffsets = new Uint32Array(1);
        this.payload = new Uint32Array(0);

        if (this.triangleCount === 0 || vertices.length === 0) {
            return;
        }

        // Compute cell size from the input

        const [min, max] = [vertices[0].clone(), vertices[0].clone()];
        for (let i = 1; i < vertices.length; ++i) {
            const v = vertices[i];
            min.x = Math.min(min.x, v.x);
            min.y = Math.min(min.y, v.y);
            max.x = Math.max(max.x, v.x);
            max.y = Math.max(max.y, v.y);
        }

        if (maxCellSize) {
            const optimalCellCount = Math.ceil(Math.max(max.x - min.x, max.y - min.y) / maxCellSize);
            cellCount = Math.max(cellCount, optimalCellCount);
        }

        if (cellCount === 0) {
            return;
        }

        this.min = min;
        this.max = max;

        const size = this.max.sub(this.min);
        size.x = Math.max(size.x, 1);
        size.y = Math.max(size.y, 1);

        const maxExt = Math.max(size.x, size.y);
        const cellSize = maxExt / cellCount;

        this.cellsX = Math.max(1, Math.ceil(size.x / cellSize));
        this.cellsY = Math.max(1, Math.ceil(size.y / cellSize));
        this.xScale = 1.0 / cellSize;
        this.yScale = 1.0 / cellSize;

        const cellCountTotal = this.cellsX * this.cellsY;
        const cellOffsets = new Uint32Array(cellCountTotal + 1);
        // flat (cellIdx, triIdx) pairs
        const associatedTriangles: number[] = [];

        // For each triangle find all intersecting cells
        for (let t = 0; t < this.triangleCount; t++) {
            const v0 = vertices[indices[t * 3 + 0]].sub(this.min);
            const v1 = vertices[indices[t * 3 + 1]].sub(this.min);
            const v2 = vertices[indices[t * 3 + 2]].sub(this.min);

            const minx = toCellIdx(Math.floor(Math.min(v0.x, v1.x, v2.x)), this.xScale, this.cellsX);
            const maxx = toCellIdx(Math.floor(Math.max(v0.x, v1.x, v2.x)), this.xScale, this.cellsX);
            const miny = toCellIdx(Math.floor(Math.min(v0.y, v1.y, v2.y)), this.yScale, this.cellsY);
            const maxy = toCellIdx(Math.floor(Math.max(v0.y, v1.y, v2.y)), this.yScale, this.cellsY);

            // Pre-allocate corner points of a cell
            const c00 = new Point(0, 0);
            const c10 = new Point(0, 0);
            const c01 = new Point(0, 0);
            const c11 = new Point(0, 0);

            for (let y = miny; y <= maxy; ++y) {
                c00.y = c10.y = y * cellSize;
                c01.y = c11.y = (y + 1) * cellSize;

                for (let x = minx; x <= maxx; ++x) {
                    c00.x = c01.x = x * cellSize;
                    c10.x = c11.x = (x + 1) * cellSize;

                    if (!triangleIntersectsTriangle(v0, v1, v2, c00, c10, c11) &&
                        !triangleIntersectsTriangle(v0, v1, v2, c00, c11, c01)) {
                        continue;
                    }

                    const cellIdx = y * this.cellsX + x;
                    associatedTriangles.push(cellIdx, t);
                    cellOffsets[cellIdx + 1]++;
                }
            }
        }

        this.cellOffsets = cellOffsets;
        if (associatedTriangles.length === 0) {
            return;
        }

        // Counting sort by cell: triangles were visited in ascending order, so each cell's list stays sorted
        for (let i = 0; i < cellCountTotal; i++) cellOffsets[i + 1] += cellOffsets[i];
        const payload = this.payload = new Uint32Array(associatedTriangles.length / 2);
        const cursor = cellOffsets.slice(0, cellCountTotal);
        for (let i = 0; i < associatedTriangles.length; i += 2) {
            payload[cursor[associatedTriangles[i]]++] = associatedTriangles[i + 1];
        }
    }

    _lazyInitLookup() {
        if (!this.lookup) {
            this.lookup = new Uint8Array(Math.ceil(this.triangleCount / 8));
        }
        this.lookup.fill(0);
    }

    queryPoint(p: Point, out: Array<number>): void {
        if (this.payload.length === 0) {
            return;
        }

        if (p.x > this.max.x || this.min.x > p.x || p.y > this.max.y || this.min.y > p.y) {
            return;
        }

        const x = toCellIdx(p.x - this.min.x, this.xScale, this.cellsX);
        const y = toCellIdx(p.y - this.min.y, this.yScale, this.cellsY);

        const cellIdx = y * this.cellsX + x;
        const start = this.cellOffsets[cellIdx];
        const end = this.cellOffsets[cellIdx + 1];

        if (start === end) {
            return;
        }

        // Use a bitset for lookups
        this._lazyInitLookup();

        for (let i = start; i < end; i++) {
            const triIdx = this.payload[i];

            // Check the lookup bitset if the triangle has been visited already
            const byte = Math.floor(triIdx / 8);
            const bit = 1 << (triIdx % 8);

            if (this.lookup[byte] & bit) {
                continue;
            }

            this.lookup[byte] |= bit;
            out.push(triIdx);

            if (out.length === this.triangleCount) {
                // All triangles visited already
                return;
            }
        }
    }

    query(bbMin: Point, bbMax: Point, out: Array<number>): void {
        if (this.payload.length === 0) {
            return;
        }

        if (bbMin.x > this.max.x || this.min.x > bbMax.x) {
            return;
        } else if (bbMin.y > this.max.y || this.min.y > bbMax.y) {
            return;
        }

        // Use a bitset for lookups
        this._lazyInitLookup();

        const mnx = toCellIdx(bbMin.x - this.min.x, this.xScale, this.cellsX);
        const mxx = toCellIdx(bbMax.x - this.min.x, this.xScale, this.cellsX);
        const mny = toCellIdx(bbMin.y - this.min.y, this.yScale, this.cellsY);
        const mxy = toCellIdx(bbMax.y - this.min.y, this.yScale, this.cellsY);

        for (let y = mny; y <= mxy; y++) {
            for (let x = mnx; x <= mxx; x++) {
                const cellIdx = y * this.cellsX + x;
                const end = this.cellOffsets[cellIdx + 1];

                for (let i = this.cellOffsets[cellIdx]; i < end; i++) {
                    const triIdx = this.payload[i];

                    // Check the lookup bitset if the triangle has been visited already
                    const byte = Math.floor(triIdx / 8);
                    const bit = 1 << (triIdx % 8);

                    if (this.lookup[byte] & bit) {
                        continue;
                    }

                    this.lookup[byte] |= bit;
                    out.push(triIdx);

                    if (out.length === this.triangleCount) {
                        // All triangles visited already
                        return;
                    }
                }
            }
        }
    }
}

function toCellIdx(p: number, scale: number, cells: number): number {
    return Math.max(0, Math.min(cells - 1, Math.floor(p * scale)));
}

register(TriangleGridIndex, 'TriangleGridIndex');

export default TriangleGridIndex;
