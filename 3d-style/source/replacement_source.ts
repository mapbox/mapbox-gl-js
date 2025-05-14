import Point from '@mapbox/point-geometry';
import EXTENT from '../../src/style-spec/data/extent';
import {triangleIntersectsTriangle, polygonContainsPoint} from '../../src/util/intersection_tests';
import deepEqual from '../../src/style-spec/util/deep_equal';

import type {UnwrappedTileID, CanonicalTileID} from '../../src/source/tile_id';
import type {Bucket} from '../../src/data/bucket';
import type {Footprint, TileFootprint} from '../util/conflation';
import type SourceCache from '../../src/source/source_cache';

export const ReplacementOrderLandmark = Number.MAX_SAFE_INTEGER;

// Abstract interface that acts as a source for footprints used in the replacement process
interface FootprintSource {
    getSourceId: () => string;
    getFootprints: () => Array<TileFootprint>;
    getOrder: () => number;
    getClipMask: () => number;
    getClipScope: () => Array<string>;
}

type Region = {
    min: Point // in tile;
    max: Point;
    sourceId: string;
    footprint: Footprint;
    footprintTileId: UnwrappedTileID;
    order: number;
    clipMask: number;
    clipScope: Array<string>;
};

type RegionData = {
    min: Point // in mercator;
    max: Point;
    hiddenByOverlap: boolean;
    priority: number;
    tileId: UnwrappedTileID;
    footprint: Footprint;
    order: number;
    clipMask: number;
    clipScope: Array<string>;
};

function scopeSkipsClipping(scope: string, scopes: Array<string>) : boolean {
    return (scopes.length !== 0 && scopes.find((el) => { return el === scope; }) === undefined);
}

export function skipClipping(region: Region, layerIndex: number, mask: number, scope: string): boolean {
    return region.order < layerIndex || region.order === ReplacementOrderLandmark || !(region.clipMask & mask) || scopeSkipsClipping(scope, region.clipScope);
}

class ReplacementSource {
    _updateTime: number;
    _sourceIds: Array<string>;
    _activeRegions: Array<RegionData>;
    _prevRegions: Array<RegionData>;
    _globalClipBounds: {
        min: Point;
        max: Point;
    };

    constructor() {
        this._updateTime = 0;
        this._sourceIds = [];
        this._activeRegions = [];
        this._prevRegions = [];
        this._globalClipBounds = {min: new Point(Infinity, Infinity), max: new Point(-Infinity, -Infinity)};
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

    getReplacementRegionsForTile(id: UnwrappedTileID, checkAgainstGlobalClipBounds: boolean = false): Array<Region> {
        const tileBounds = transformAabbToMerc(new Point(0, 0), new Point(EXTENT, EXTENT), id);
        const result: Array<Region> = [];

        if (checkAgainstGlobalClipBounds) {
            if (!regionsOverlap(tileBounds, this._globalClipBounds))
                return result;
        }

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
                footprintTileId: region.tileId,
                order: region.order,
                clipMask: region.clipMask,
                clipScope: region.clipScope
            });
        }

        return result;
    }

    setSources(sources: Array<{
        layer: string;
        cache: SourceCache;
        order: number;
        clipMask: number;
        clipScope: Array<string>;
    }>) {
        this._setSources(sources.map(source => {
            return {
                getSourceId: () => {
                    return source.cache.id;
                },
                getFootprints: () => {
                    const footprints: Array<TileFootprint> = [];

                    for (const id of source.cache.getVisibleCoordinates()) {
                        const tile = source.cache.getTile(id);
                        const bucket: Bucket | null | undefined = tile.buckets[source.layer];
                        if (bucket) {
                            bucket.updateFootprints(id.toUnwrapped(), footprints);
                        }
                    }

                    return footprints;
                },
                getOrder: () => {
                    return source.order;
                },
                getClipMask: () => {
                    return source.clipMask;
                },
                getClipScope: () => {
                    return source.clipScope;
                }
            };
        }));
    }

    _addSource(source: FootprintSource) {
        const footprints = source.getFootprints();

        if (footprints.length === 0) {
            return;
        }
        const order = source.getOrder();
        const clipMask = source.getClipMask();
        const clipScope = source.getClipScope();

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
                footprint: fp.footprint,
                order,
                clipMask,
                clipScope
            });
        }

        this._sourceIds.push(source.getSourceId());
    }

    _computeReplacement() {
        this._activeRegions.sort((a, b) => {
            return a.priority - b.priority || comparePoint(a.min, b.min) || comparePoint(a.max, b.max) || a.order - b.order || a.clipMask - b.clipMask || compareClipScopes(a.clipScope, b.clipScope);
        });

        // Check if active regions have changed since last update
        let regionsChanged = this._activeRegions.length !== this._prevRegions.length;

        if (!regionsChanged) {
            let idx = 0;

            while (!regionsChanged && idx !== this._activeRegions.length) {
                const curr = this._activeRegions[idx];
                const prev = this._prevRegions[idx];

                regionsChanged = curr.priority !== prev.priority || !boundsEquals(curr, prev) || (curr.order !== prev.order) || (curr.clipMask !== prev.clipMask || !deepEqual(curr.clipScope, prev.clipScope));

                ++idx;
            }
        }

        if (regionsChanged) {
            ++this._updateTime;

            for (const region of this._activeRegions) {
                if (region.order !== ReplacementOrderLandmark) {
                    this._globalClipBounds.min.x = Math.min(this._globalClipBounds.min.x, region.min.x);
                    this._globalClipBounds.min.y = Math.min(this._globalClipBounds.min.y, region.min.y);
                    this._globalClipBounds.max.x = Math.max(this._globalClipBounds.max.x, region.max.x);
                    this._globalClipBounds.max.y = Math.max(this._globalClipBounds.max.y, region.max.y);
                }
            }

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
                        // and check whether they've been occluded by any other regions
                        // with higher priority
                        active.hiddenByOverlap = false;

                        for (let prevIdx = 0; prevIdx < prevRangeEnd; prevIdx++) {
                            const prev = this._activeRegions[prevIdx];

                            if (prev.hiddenByOverlap) {
                                continue;
                            }

                            if (active.order !== ReplacementOrderLandmark) {
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

function compareClipScopes(a: string[], b: string[]) {
    const concat = (t: string, n: string) => { return t + n; };
    return a.length - b.length || a.reduce(concat, '').localeCompare(b.reduce(concat, ''));
}

function boundsEquals(
    a: {
        min: Point;
        max: Point;
    },
    b: {
        min: Point;
        max: Point;
    },
): boolean {
    return comparePoint(a.min, b.min) === 0 && comparePoint(a.max, b.max) === 0;
}

function regionsOverlap(
    a: {
        min: Point;
        max: Point;
    },
    b: {
        min: Point;
        max: Point;
    },
): boolean {
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
        if (a[i].sourceId !== b[i].sourceId || !boundsEquals(a[i], b[i]) || a[i].order !== b[i].order || a[i].clipMask !== b[i].clipMask || !deepEqual(a[i].clipScope, b[i].clipScope)) {
            return false;
        }
    }

    return true;
}

function transformAabbToMerc(min: Point, max: Point, id: UnwrappedTileID): {
    min: Point;
    max: Point;
} {
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

function transformAabbToTile(min: Point, max: Point, id: UnwrappedTileID): {
    min: Point;
    max: Point;
} {
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

function footprintTrianglesIntersect(
    footprint: Footprint,
    vertices: Array<Point>,
    indices: Array<number> | Uint16Array,
    indexOffset: number,
    indexCount: number,
    baseVertex: number,
    padding: number,
): boolean {
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
            const x = (v.x + srcId.x * EXTENT) * zDiff - dstId.x * EXTENT;
            const y = (v.y + srcId.y * EXTENT) * zDiff - dstId.y * EXTENT;
            return new Point(x, y);
        });
    }

    return footprintTrianglesIntersect(b, queryVertices, a.indices, 0, a.indices.length, 0, 0);
}

function transformPointToTile(x: number, y: number, src: CanonicalTileID, dst: CanonicalTileID): Point {
    // convert a point in src tile coordinates to dst tile coordinates.
    const zDiff = Math.pow(2.0, dst.z - src.z);
    const xf = (x + src.x * EXTENT) * zDiff - dst.x * EXTENT;
    const yf = (y + src.y * EXTENT) * zDiff - dst.y * EXTENT;
    return new Point(xf, yf);
}

function pointInFootprint(p: Point, footprint: Footprint): boolean {
    // get a list of all triangles that potentially cover this point.
    const candidateTriangles = [];
    footprint.grid.queryPoint(p, candidateTriangles);

    // finally check if the point is in any of the triangles.
    const fpIndices: Array<number> = footprint.indices;
    const fpVertices: Array<Point> = footprint.vertices;
    for (let j = 0; j < candidateTriangles.length; j++) {
        const triIdx = candidateTriangles[j];
        const triangle = [
            fpVertices[fpIndices[triIdx * 3 + 0]],
            fpVertices[fpIndices[triIdx * 3 + 1]],
            fpVertices[fpIndices[triIdx * 3 + 2]]
        ];

        if (polygonContainsPoint(triangle, p)) {
            return true;
        }
    }

    return false;
}

export type {TileFootprint, FootprintSource, Region};
export {ReplacementSource, regionsEquals, footprintTrianglesIntersect, transformPointToTile, pointInFootprint};
