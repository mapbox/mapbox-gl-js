// @flow

import {triangleIntersectsTriangle} from "./intersection_tests.js";
import Point from "@mapbox/point-geometry";
import {register} from "./web_worker_transfer.js";

type Cell = {
    start: number;
    len: number;
};

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
    cells: Array<?Cell>;
    payload: Array<number>
    lookup: ?Uint8Array;

    constructor(vertices: Array<Point>, indices: Array<number>, cellCount: number) {
        this.triangleCount = indices.length / 3;
        this.min = new Point(0, 0);
        this.max = new Point(0, 0);
        this.xScale = 0;
        this.yScale = 0;
        this.cellsX = 0;
        this.cellsY = 0;
        this.cells = [];
        this.payload = [];

        if (this.triangleCount === 0 || vertices.length === 0 || cellCount === 0) {
            return;
        }

        // Compute cell size from the input
        const xCoords = vertices.map(v => v.x);
        const yCoords = vertices.map(v => v.y);

        this.min = new Point(Math.min(...xCoords), Math.min(...yCoords));
        this.max = new Point(Math.max(...xCoords), Math.max(...yCoords));

        const size = this.max.sub(this.min);
        size.x = Math.max(size.x, 1);
        size.y = Math.max(size.y, 1);

        const maxExt = Math.max(size.x, size.y);
        const cellSize = maxExt / cellCount;

        this.cellsX = Math.max(1, Math.ceil(size.x / cellSize));
        this.cellsY = Math.max(1, Math.ceil(size.y / cellSize));
        this.xScale = 1.0 / cellSize;
        this.yScale = 1.0 / cellSize;

        const associatedTriangles = [];

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

                    associatedTriangles.push({cellIdx: y * this.cellsX + x, triIdx: t});
                }
            }
        }

        if (associatedTriangles.length === 0) {
            return;
        }

        // Store cell payload (a list of contained triangles) in adjacent memory cell by cell
        associatedTriangles.sort((a, b) => a.cellIdx - b.cellIdx || a.triIdx - b.triIdx);

        let idx = 0;
        while (idx < associatedTriangles.length) {
            const cellIdx = associatedTriangles[idx].cellIdx;
            const cell = {start: this.payload.length, len:0};

            // Find all triangles belonging to the current cell
            while (idx < associatedTriangles.length && associatedTriangles[idx].cellIdx === cellIdx) {
                ++cell.len;
                this.payload.push(associatedTriangles[idx++].triIdx);
            }

            this.cells[cellIdx] = cell;
        }
    }

    query(bbMin: Point, bbMax: Point, out: Array<number>): void {
        if (this.triangleCount === 0 || this.cells.length === 0) {
            return;
        }

        if (bbMin.x > this.max.x || this.min.x > bbMax.x) {
            return;
        } else if (bbMin.y > this.max.y || this.min.y > bbMax.y) {
            return;
        }

        // Use a bitset for lookups
        if (!this.lookup) {
            this.lookup = new Uint8Array(Math.ceil(this.triangleCount / 8));
        }

        for (let i = 0; i < this.lookup.length; i++) {
            this.lookup[i] = 0;
        }

        const mnx = toCellIdx(bbMin.x - this.min.x, this.xScale, this.cellsX);
        const mxx = toCellIdx(bbMax.x - this.min.x, this.xScale, this.cellsX);
        const mny = toCellIdx(bbMin.y - this.min.y, this.yScale, this.cellsY);
        const mxy = toCellIdx(bbMax.y - this.min.y, this.yScale, this.cellsY);

        for (let y = mny; y <= mxy; y++) {
            for (let x = mnx; x <= mxx; x++) {
                const cell = this.cells[y * this.cellsX + x];

                if (!cell) {
                    continue;
                }

                for (let i = 0; i < cell.len; i++) {
                    const triIdx = this.payload[cell.start + i];

                    // Check the lookup bitset if the triangle has been visited already
                    const byte = Math.floor(triIdx / 8);
                    const bit = 1 << (triIdx % 8);

                    if ((this.lookup: any)[byte] & bit) {
                        continue;
                    }

                    (this.lookup: any)[byte] |= bit;
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
