// @flow

import Point from '@mapbox/point-geometry';
import EXTENT from '../../src/style-spec/data/extent.js';
import {UnwrappedTileID} from '../../src/source/tile_id.js';
import {triangleIntersectsTriangle} from '../../src/util/intersection_tests.js';

import type Tiled3dModelBucket from '../../3d-style/data/bucket/tiled_3d_model_bucket.js';
import type {Footprint} from '../data/model.js';
import type SourceCache from '../../src/source/source_cache.js';

type TileFootprint = {
    footprint: Footprint,
    id: UnwrappedTileID,
}

// Abstract interface that acts as a source for footprints used in the replacement process
interface FootprintSource {
    getSourceId():string,
    getFootprints(): Array<TileFootprint>
}

type Region = {
    min: Point;
    max: Point;
    sourceId: string;
    footprint: Footprint;
    footprintTileId: UnwrappedTileID;
}

type RegionData = {
    min: Point;
    max: Point;
    hiddenByOverlap: boolean,
    priority: number,
    tileId: UnwrappedTileID,
    footprint: Footprint
}

class ReplacementSource {
    _updateTime: number;
    _sourceIds: Array<string>;
    _activeRegions: Array<RegionData>;
    _prevRegions: Array<RegionData>;

    constructor() {
        this._updateTime = 0;
        this._sourceIds = [];
        this._activeRegions = [];
        this._prevRegions = [];
    }

    clear() {
        if (this._activeRegions.length > 0) {
            ++this._updateTime;
        }

        this._activeRegions = [];
        this._prevRegions = [];
    }

    get updateTime(): number {
        return this._updateTime;
    }

    getReplacementRegionsForTile(id: UnwrappedTileID): Array<Region> {
        const tileBounds = transformAabbToMerc(new Point(0, 0), new Point(EXTENT, EXTENT), id);
        const result: Array<Region> = [];

        for (const region of this._activeRegions) {
            if (region.hiddenByOverlap) {
                continue;
            }

            if (!regionsOverlap(tileBounds, region)) {
                continue;
            }

            const bounds = transformAabbToTile(region.min, region.max, id);
            result.push({
                min: bounds.min,
                max: bounds.max,
                sourceId: this._sourceIds[region.priority],
                footprint: region.footprint,
                footprintTileId: region.tileId
            });
        }

        return result;
    }

    setSources(sources: Array<{ layer: string, cache: SourceCache }>) {
        this._setSources(sources.map(source => {
            return {
                getSourceId: () => {
                    return source.cache.id;
                },
                getFootprints: () => {
                    const footprints: Array<TileFootprint> = [];

                    for (const id of source.cache.getVisibleCoordinates()) {
                        const tile = source.cache.getTile(id);
                        const bucket: ?Tiled3dModelBucket = (tile.buckets[source.layer]: any);
                        if (!bucket) {
                            continue;
                        }
                        for (const nodeInfo of bucket.getNodesInfo()) {
                            const node = nodeInfo.node;
                            if (!node.footprint) {
                                continue;
                            }
                            footprints.push({
                                footprint: node.footprint,
                                id: id.toUnwrapped()
                            });
                        }
                    }

                    return footprints;
                }
            };
        }));
    }

    _addSource(source: FootprintSource) {
        const footprints = source.getFootprints();

        if (footprints.length === 0) {
            return;
        }

        for (const fp of footprints) {
            if (!fp.footprint) {
                continue;
            }

            const bounds = transformAabbToMerc(fp.footprint.min, fp.footprint.max, fp.id);

            this._activeRegions.push({
                min: bounds.min,
                max: bounds.max,
                hiddenByOverlap: false,
                priority: this._sourceIds.length,
                tileId: fp.id,
                footprint: fp.footprint
            });
        }

        this._sourceIds.push(source.getSourceId());
    }

    _computeReplacement() {
        this._activeRegions.sort((a, b) => {
            return a.priority - b.priority || comparePoint(a.min, b.min) || comparePoint(a.max, b.max);
        });

        // Check if active regions have changed since last update
        let regionsChanged = this._activeRegions.length !== this._prevRegions.length;

        if (!regionsChanged) {
            let activeIdx = 0;
            let prevIdx = 0;

            while (!regionsChanged && activeIdx !== this._activeRegions.length) {
                const curr = this._activeRegions[activeIdx];
                const prev = this._prevRegions[prevIdx];

                regionsChanged = curr.priority !== prev.priority || !boundsEquals(curr, prev);

                ++activeIdx;
                ++prevIdx;
            }
        }

        if (regionsChanged) {
            ++this._updateTime;

            const firstRegionOfNextPriority = (idx: number) => {
                const regs = this._activeRegions;

                if (idx >= regs.length) {
                    return idx;
                }

                const priority = regs[idx].priority;
                while (idx < regs.length && regs[idx].priority === priority) {
                    ++idx;
                }

                return idx;
            };

            if (this._sourceIds.length > 1) {
                // More than one replacement source exists in the style.
                // Hide any overlapping regions in subsequent sources.

                // Travel through all regions and hide regions overlapping with
                // ones with higher priority.
                let rangeBegin = 0;
                let rangeEnd = firstRegionOfNextPriority(rangeBegin);

                while (rangeBegin !== rangeEnd) {
                    let idx = rangeBegin;
                    const prevRangeEnd = rangeBegin;

                    while (idx !== rangeEnd) {
                        const active = this._activeRegions[idx];

                        // Go through each footprint in the current priority level
                        // and check whether they're been occluded by any other regions
                        // with higher priority
                        active.hiddenByOverlap = false;

                        for (let prevIdx = 0; prevIdx < prevRangeEnd; prevIdx++) {
                            const prev = this._activeRegions[prevIdx];

                            if (prev.hiddenByOverlap) {
                                continue;
                            }

                            if (regionsOverlap(active, prev)) {
                                active.hiddenByOverlap = footprintsIntersect(active.footprint, active.tileId, prev.footprint, prev.tileId);
                                if (active.hiddenByOverlap) {
                                    break;
                                }
                            }
                        }

                        ++idx;
                    }

                    rangeBegin = rangeEnd;
                    rangeEnd = firstRegionOfNextPriority(rangeBegin);
                }
            }
        }
    }

    _setSources(sources: Array<FootprintSource>) {
        // $FlowIssue[unsupported-syntax]
        [this._prevRegions, this._activeRegions] = [this._activeRegions, []];
        this._sourceIds = [];

        for (let i = sources.length - 1; i >= 0; i--) {
            this._addSource(sources[i]);
        }

        this._computeReplacement();
    }
}

function comparePoint(a: Point, b: Point): number {
    return a.x - b.x || a.y - b.y;
}

function boundsEquals(a: {min: Point, max: Point}, b: {min: Point, max: Point}): boolean {
    return comparePoint(a.min, b.min) === 0 && comparePoint(a.max, b.max) === 0;
}

function regionsOverlap(a: {min: Point, max: Point}, b: {min: Point, max: Point}): boolean {
    if (a.min.x > b.max.x || a.max.x < b.min.x)
        return false;
    else if (a.min.y > b.max.y || a.max.y < b.min.y)
        return false;
    return true;
}

function regionsEquals(a: Array<Region>, b: Array<Region>): boolean {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i].sourceId !== b[i].sourceId || !boundsEquals(a[i], b[i])) {
            return false;
        }
    }

    return true;
}

function transformAabbToMerc(min: Point, max: Point, id: UnwrappedTileID): {min: Point, max: Point} {
    const invExtent = 1.0 / EXTENT;
    const invTiles = 1.0 / (1 << id.canonical.z);

    const minx = (min.x * invExtent + id.canonical.x) * invTiles + id.wrap;
    const maxx = (max.x * invExtent + id.canonical.x) * invTiles + id.wrap;
    const miny = (min.y * invExtent + id.canonical.y) * invTiles;
    const maxy = (max.y * invExtent + id.canonical.y) * invTiles;

    return {
        min: new Point(minx, miny),
        max: new Point(maxx, maxy)
    };
}

function transformAabbToTile(min: Point, max: Point, id: UnwrappedTileID): {min: Point, max: Point} {
    const tiles = 1 << id.canonical.z;

    const minx = ((min.x - id.wrap) * tiles - id.canonical.x) * EXTENT;
    const maxx = ((max.x - id.wrap) * tiles - id.canonical.x) * EXTENT;
    const miny = (min.y * tiles - id.canonical.y) * EXTENT;
    const maxy = (max.y * tiles - id.canonical.y) * EXTENT;

    return {
        min: new Point(minx, miny),
        max: new Point(maxx, maxy)
    };
}

function footprintTrianglesIntersect(footprint: Footprint, vertices: Array<Point>, indices: Array<number> | Uint16Array, indexOffset: number, indexCount: number, baseVertex: number, padding: number): boolean {
    const fpIndices = footprint.indices;
    const fpVertices = footprint.vertices;
    const candidateTriangles = [];

    for (let i = indexOffset; i < indexOffset + indexCount; i += 3) {
        const a = vertices[indices[i + 0] + baseVertex];
        const b = vertices[indices[i + 1] + baseVertex];
        const c = vertices[indices[i + 2] + baseVertex];

        const mnx = Math.min(a.x, b.x, c.x);
        const mxx = Math.max(a.x, b.x, c.x);
        const mny = Math.min(a.y, b.y, c.y);
        const mxy = Math.max(a.y, b.y, c.y);

        candidateTriangles.length = 0;
        footprint.grid.query(new Point(mnx, mny), new Point(mxx, mxy), candidateTriangles);

        for (let j = 0; j < candidateTriangles.length; j++) {
            const triIdx = candidateTriangles[j];
            const v0 = fpVertices[fpIndices[triIdx * 3 + 0]];
            const v1 = fpVertices[fpIndices[triIdx * 3 + 1]];
            const v2 = fpVertices[fpIndices[triIdx * 3 + 2]];

            if (triangleIntersectsTriangle(v0, v1, v2, a, b, c, padding)) {
                return true;
            }
        }
    }

    return false;
}

function footprintsIntersect(a: Footprint, aTile: UnwrappedTileID, b: Footprint, bTile: UnwrappedTileID): boolean {
    if (!a || !b) {
        return false;
    }

    let queryVertices = a.vertices;

    // Convert vertices of the smaller footprint to the coordinate space of the larger one
    if (!aTile.canonical.equals(bTile.canonical) || aTile.wrap !== bTile.wrap) {
        if (b.vertices.length < a.vertices.length) {
            return footprintsIntersect(b, bTile, a, aTile);
        }

        const srcId = aTile.canonical;
        const dstId = bTile.canonical;
        const zDiff = Math.pow(2.0, dstId.z - srcId.z);

        queryVertices = a.vertices.map(v => {
            const x = (v.x * srcId.x * EXTENT) * zDiff - dstId.x * EXTENT;
            const y = (v.y * srcId.y * EXTENT) * zDiff - dstId.y * EXTENT;

            return new Point(x, y);
        });
    }

    return footprintTrianglesIntersect(b, queryVertices, a.indices, 0, a.indices.length, 0, 0);
}

export type {TileFootprint, FootprintSource, Region};
export {ReplacementSource, regionsEquals, footprintTrianglesIntersect};
