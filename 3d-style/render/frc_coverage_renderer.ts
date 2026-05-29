import SegmentVector from '../../src/data/segment';
import {PosArray, TriangleIndexArray} from '../../src/data/array_types';
import posAttributes from '../../src/data/pos_attributes';
import earcut from 'earcut';

// FRC level bound (0..8 — motorway..pedestrian; bit position in coverage mask).
export const MAX_FRC_LEVELS = 9;

import type Context from '../../src/gl/context';
import type VertexBuffer from '../../src/gl/vertex_buffer';
import type IndexBuffer from '../../src/gl/index_buffer';
import type {FrcCoverageTile} from '../../src/source/frc_coverage_snapshot';
import type {CanonicalTileID} from '../../src/source/tile_id';

export interface CoverageTileBuffers {
    vertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    /// Per-FRC-level segments for drawing only polygons covering that level
    frcLevelSegments: Array<SegmentVector | null>;
}

/// Maintains per-tile GPU buffers for FRC coverage polygon rendering.
/// Supports multiple polygons per tile with different frcMask values.
/// One shared vertex/index buffer per tile, with per-FRC-level segment ranges.
export class FrcCoverageRenderer {
    tileBuffers: Map<string, CoverageTileBuffers>;
    _context: Context | null;

    constructor() {
        this.tileBuffers = new Map();
        this._context = null;
    }

    update(context: Context, coverageTiles: Array<FrcCoverageTile>) {
        this._context = context;

        const newKeys = new Set<string>();
        for (const tile of coverageTiles) {
            if (tile.frcMask === 0) continue;
            let anyGeometry = false;
            for (const p of tile.polygons) {
                if (p.hasGeometry()) { anyGeometry = true; break; }
            }
            if (!anyGeometry) continue;

            const key = `${tile.tileId.z}/${tile.tileId.x}/${tile.tileId.y}`;
            newKeys.add(key);

            if (!this.tileBuffers.has(key)) {
                const buffers = this._createBuffers(context, tile);
                if (buffers) {
                    this.tileBuffers.set(key, buffers);
                }
            }
        }

        for (const key of this.tileBuffers.keys()) {
            if (!newKeys.has(key)) {
                const buffers = this.tileBuffers.get(key);
                buffers.vertexBuffer.destroy();
                buffers.indexBuffer.destroy();
                for (const seg of buffers.frcLevelSegments) {
                    if (seg) seg.destroy();
                }
                this.tileBuffers.delete(key);
            }
        }
    }

    getBuffers(tileId: CanonicalTileID): CoverageTileBuffers | null {
        const key = `${tileId.z}/${tileId.x}/${tileId.y}`;
        return this.tileBuffers.get(key) || null;
    }

    destroy() {
        for (const buffers of this.tileBuffers.values()) {
            buffers.vertexBuffer.destroy();
            buffers.indexBuffer.destroy();
            for (const seg of buffers.frcLevelSegments) {
                if (seg) seg.destroy();
            }
        }
        this.tileBuffers.clear();
    }

    _createBuffers(context: Context, tile: FrcCoverageTile): CoverageTileBuffers | null {
        const vertexArray = new PosArray();
        const indexArray = new TriangleIndexArray();

        // Track per-polygon ranges for building per-FRC-level segments
        interface PolyRange {
            vertexOffset: number;
            indexOffset: number;
            vertexCount: number;
            indexCount: number;
            frcMask: number;
        }
        const ranges: PolyRange[] = [];

        // Concatenate all polygon vertices and indices into shared buffers
        for (const poly of tile.polygons) {
            if (!poly.hasGeometry() || poly.rings.length === 0) continue;

            const vOffset = vertexArray.length;
            const iOffset = indexArray.length;

            // Add all ring vertices
            const polyBaseVertex = vertexArray.length;
            const flatCoords: number[] = [];
            const holeIndices: number[] = [];
            let vertCount = 0;
            for (let ri = 0; ri < poly.rings.length; ri++) {
                const ring = poly.rings[ri];
                if (ring.length < 3) continue;
                if (ri > 0) holeIndices.push(vertCount);
                for (const p of ring) {
                    vertexArray.emplaceBack(p.x, p.y);
                    flatCoords.push(p.x, p.y);
                    vertCount++;
                }
            }
            // Use earcut for proper triangulation (handles concave and multi-ring polygons)
            // earcut library lacks proper type definitions
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const triangles = earcut(flatCoords, holeIndices.length > 0 ? holeIndices : undefined) as number[];
            for (let i = 0; i < triangles.length; i += 3) {
                indexArray.emplaceBack(
                    polyBaseVertex + triangles[i],
                    polyBaseVertex + triangles[i + 1],
                    polyBaseVertex + triangles[i + 2]);
            }

            ranges.push({
                vertexOffset: vOffset,
                indexOffset: iOffset,
                vertexCount: vertexArray.length - vOffset,
                indexCount: indexArray.length - iOffset,
                frcMask: poly.frcMask,
            });
        }

        if (vertexArray.length === 0) return null;

        // Build per-FRC-level segments
        const frcLevelSegments: Array<SegmentVector | null> = new Array<SegmentVector | null>(MAX_FRC_LEVELS).fill(null);
        for (let frc = 0; frc < MAX_FRC_LEVELS; ++frc) {
            const bit = 1 << frc;
            if ((tile.frcMask & bit) === 0) continue;

            let minIndex = Infinity;
            let maxIndex = 0;
            let maxVertex = 0;
            let found = false;

            for (const r of ranges) {
                if ((r.frcMask & bit) === 0) continue;
                minIndex = Math.min(minIndex, r.indexOffset);
                maxIndex = Math.max(maxIndex, r.indexOffset + r.indexCount);
                maxVertex = Math.max(maxVertex, r.vertexOffset + r.vertexCount);
                found = true;
            }

            if (found) {
                // vertexOffset=0 because indices contain absolute vertex positions.
                // vertexLength covers all vertices up to the last one referenced.
                frcLevelSegments[frc] = SegmentVector.simpleSegment(
                    0, minIndex, maxVertex, maxIndex - minIndex);
            }
        }

        const vertexBuffer = context.createVertexBuffer(vertexArray, posAttributes.members);
        const indexBuffer = context.createIndexBuffer(indexArray);

        return {
            vertexBuffer,
            indexBuffer,
            frcLevelSegments,
        };
    }
}
