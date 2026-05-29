import EXTENT from '../../src/style-spec/data/extent';

import type Point from '@mapbox/point-geometry';
import type {CanonicalTileID} from '../../src/source/tile_id';
import type {FrcCoveragePolygons, FrcCoverageTile, FrcCoverageSnapshot as IFrcCoverageSnapshot} from '../../src/source/frc_coverage_snapshot';

/**
 * Compute combined frcMask from an array of polygons.
 * @param {FrcCoveragePolygons} polygons Polygons to OR-combine masks of.
 * @returns {number} Bitwise OR of all polygon frcMask values.
 * @private
 */
export function combinedFrcMask(polygons: FrcCoveragePolygons): number {
    let mask = 0;
    for (const p of polygons) {
        mask |= p.frcMask;
    }
    return mask;
}

export class FrcCoverageSnapshot implements IFrcCoverageSnapshot {
    tiles: Array<FrcCoverageTile>;

    constructor(tiles: Array<FrcCoverageTile> = []) {
        this.tiles = tiles;
    }

    getTile(id: CanonicalTileID): FrcCoverageTile | null {
        for (const tile of this.tiles) {
            if (tile.tileId.z === id.z && tile.tileId.x === id.x && tile.tileId.y === id.y) {
                return tile;
            }
        }
        return null;
    }

    getTileOrParent(id: CanonicalTileID): FrcCoverageTile | null {
        for (let z = id.z; z > 0; --z) {
            const scaledX = Math.floor(id.x / (1 << (id.z - z)));
            const scaledY = Math.floor(id.y / (1 << (id.z - z)));
            for (const tile of this.tiles) {
                if (tile.tileId.z === z && tile.tileId.x === scaledX && tile.tileId.y === scaledY && tile.frcMask !== 0) {
                    return tile;
                }
            }
        }
        return null;
    }

    /// Returns the frcMask if the child tile is fully covered.
    /// For multi-polygon: OR the masks of all polygons that fully contain the child quad.
    getFullCoverageMask(childId: CanonicalTileID): number | null {
        let coverageTile: FrcCoverageTile | null = null;
        let coverageTileZ = 0;

        for (let z = childId.z; z > 0; --z) {
            const scaledX = Math.floor(childId.x / (1 << (childId.z - z)));
            const scaledY = Math.floor(childId.y / (1 << (childId.z - z)));
            for (const tile of this.tiles) {
                if (tile.tileId.z === z && tile.tileId.x === scaledX && tile.tileId.y === scaledY) {
                    coverageTile = tile;
                    coverageTileZ = z;
                    break;
                }
            }
            if (coverageTile) break;
        }

        if (!coverageTile || coverageTile.frcMask === 0) return null;

        // Compute child tile's quad in coverage tile coordinates
        const dz = childId.z - coverageTileZ;
        const scale = 1 << dz;
        const localX = childId.x % scale;
        const localY = childId.y % scale;
        const cellSize = EXTENT / scale;
        const rx0 = localX * cellSize;
        const ry0 = localY * cellSize;
        const rx1 = rx0 + cellSize;
        const ry1 = ry0 + cellSize;

        // For each polygon, test if child quad is fully inside.
        // OR the masks of polygons that fully contain the child.
        let containingMask = 0;
        for (const poly of coverageTile.polygons) {
            if (poly.frcMask === 0) continue;

            // Full-tile polygon — trivially contains child
            if (!poly.hasGeometry()) {
                containingMask |= poly.frcMask;
                continue;
            }

            if (poly.rings.length === 0 || childId.z <= coverageTileZ) continue;

            // Check if child quad is fully inside this polygon
            if (isQuadInsidePolygon(poly.rings, rx0, ry0, rx1, ry1)) {
                containingMask |= poly.frcMask;
            }
        }

        return containingMask !== 0 ? containingMask : null;
    }

    equals(other: Array<FrcCoverageTile>): boolean {
        if (this.tiles.length !== other.length) return false;
        for (let i = 0; i < this.tiles.length; ++i) {
            const a = this.tiles[i], b = other[i];
            if (a.tileId.z !== b.tileId.z || a.tileId.x !== b.tileId.x || a.tileId.y !== b.tileId.y ||
                a.frcMask !== b.frcMask || a.polygons.length !== b.polygons.length) {
                return false;
            }
        }
        return true;
    }

    empty(): boolean { return this.tiles.length === 0; }
}

function isQuadInsidePolygon(rings: Array<Array<Point>>,
                              rx0: number, ry0: number, rx1: number, ry1: number): boolean {
    const windCount = [0, 0, 0, 0];
    const cx = [rx0, rx1, rx1, rx0];
    const cy = [ry0, ry0, ry1, ry1];

    for (const ring of rings) {
        const n = ring.length;
        if (n < 2) continue;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const ax = ring[j].x, ay = ring[j].y;
            const bx = ring[i].x, by = ring[i].y;

            for (let c = 0; c < 4; ++c) {
                if ((ay > cy[c]) !== (by > cy[c])) {
                    const xIntersect = ax + (bx - ax) * (cy[c] - ay) / (by - ay);
                    if (cx[c] < xIntersect) {
                        windCount[c]++;
                    }
                }
            }

            let codeA = 0, codeB = 0;
            if (ax < rx0) codeA |= 1; else if (ax > rx1) codeA |= 2;
            if (ay < ry0) codeA |= 4; else if (ay > ry1) codeA |= 8;
            if (bx < rx0) codeB |= 1; else if (bx > rx1) codeB |= 2;
            if (by < ry0) codeB |= 4; else if (by > ry1) codeB |= 8;

            if (codeA & codeB) continue;
            if (codeA === 0 || codeB === 0) return false;
            if (edgeCrossesRect(ax, ay, bx, by, rx0, ry0, rx1, ry1)) return false;
        }
    }
    for (let c = 0; c < 4; ++c) {
        if ((windCount[c] & 1) === 0) return false;
    }
    return true;
}

function edgeCrossesRect(ax: number, ay: number, bx: number, by: number,
                         rx0: number, ry0: number, rx1: number, ry1: number): boolean {
    const crosses = (p0x: number, p0y: number, p1x: number, p1y: number,
        q0x: number, q0y: number, q1x: number, q1y: number): boolean => {
        const d1 = (p1x - p0x) * (q0y - p0y) - (p1y - p0y) * (q0x - p0x);
        const d2 = (p1x - p0x) * (q1y - p0y) - (p1y - p0y) * (q1x - p0x);
        if ((d1 > 0 && d2 > 0) || (d1 < 0 && d2 < 0)) return false;
        const d3 = (q1x - q0x) * (p0y - q0y) - (q1y - q0y) * (p0x - q0x);
        const d4 = (q1x - q0x) * (p1y - q0y) - (q1y - q0y) * (p1x - q0x);
        if ((d3 > 0 && d4 > 0) || (d3 < 0 && d4 < 0)) return false;
        return true;
    };
    if (crosses(ax, ay, bx, by, rx0, ry0, rx1, ry0)) return true;
    if (crosses(ax, ay, bx, by, rx1, ry0, rx1, ry1)) return true;
    if (crosses(ax, ay, bx, by, rx0, ry1, rx1, ry1)) return true;
    if (crosses(ax, ay, bx, by, rx0, ry0, rx0, ry1)) return true;
    return false;
}
