import * as martinez from 'martinez-polygon-clipping';
import Point from '@mapbox/point-geometry';

import type {EdgeIterator} from '../elevation/elevation_feature';

/**
 * Polygon clipping primitives that depend on the `martinez-polygon-clipping` library
 * (plus its transitive deps: `splaytree`, `tinyqueue`, `robust-predicates`). Only the
 * HD elevated-road path uses these — `clip` and `polygonSubdivision` are called from
 * `fill_hd_extension.ts`. Keeping them out of `src/util/polygon_clipping.ts` means the
 * ~30 KB martinez dep chain ships in the HD chunk instead of the core bundle.
 *
 * Non-martinez polygon helpers (`clipPolygon`, `gridSubdivision`) stay in core because
 * `fill_extrusion_bucket.ts` needs them on every tile regardless of HD.
 *
 * @private
 */

// Canonicalization tolerance in tile units. Sized to comfortably exceed
// martinez's per-vertex emission drift (~2e-5 observed in the MAPS3D-2108
// case) while staying far below the n + 0.5 rounding boundary, so it
// doesn't merge legitimately-distinct sub-pixel vertices.
const SUBDIVISION_ROUNDING_TOLERANCE = 1e-3;

export function clip(subjectPolygon: Point[][], clipRing: Point[]): Point[][][] {
    const geom = toMultiPolygon(subjectPolygon);
    const clipGeom = toMultiPolygon([clipRing]);

    const polygons = martinez.intersection(geom, clipGeom) as martinez.MultiPolygon;
    if (polygons == null) return [];

    return fromMultiPolygon(polygons);
}

export function polygonSubdivision(subjectPolygon: Point[][], subdivisionEdges: EdgeIterator, edgeExtension: number = 0): Point[][][] {
    // Perform clipping temporarily in a 32bit space where few unit wide polygons are just
    // lines when scaled back to 16bit.
    const scale = 1 << 16;
    let polygons = toMultiPolygon(subjectPolygon, scale);

    const clipGeometry: martinez.Polygon[] = [];

    // Split the polygon using edges from the iterator
    for (; subdivisionEdges.valid(); subdivisionEdges.next()) {
        const [a, b] = subdivisionEdges.get();

        let ax = a.x * scale;
        let ay = a.y * scale;
        let bx = b.x * scale;
        let by = b.y * scale;

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len === 0) continue;

        ax -= dx * edgeExtension;
        ay -= dy * edgeExtension;
        bx += dx * edgeExtension;
        by += dy * edgeExtension;

        // Expand the polygon towards the perpendicular vector by few units
        const shiftX = Math.trunc(dy / len * 3.0);
        const shiftY = -Math.trunc(dx / len * 3.0);

        clipGeometry.push([
            [
                [ax, ay],
                [bx, by],
                [bx + shiftX, by + shiftY],
                [ax + shiftX, ay + shiftY],
                [ax, ay]
            ]
        ]);
    }

    if (clipGeometry.length > 0) {
        polygons = martinez.diff(polygons, clipGeometry) as martinez.MultiPolygon;
    }

    // Martinez can emit nearly-identical floats for the same logical cut
    // endpoint on the two sides of a cut. `fromMultiPolygon` canonicalizes
    // pairs within `SUBDIVISION_ROUNDING_TOLERANCE` (in both axes) to one
    // integer pair so shared cut edges keep identical endpoints.
    return fromMultiPolygon(polygons, 1 / scale, SUBDIVISION_ROUNDING_TOLERANCE);
}

function toMultiPolygon(polygon: Point[][], scale: number = 1.0): martinez.MultiPolygon {
    return [polygon.map(ring => ring.map(p => [p.x * scale, p.y * scale]))];
}

/**
 * Rounds `value` to an integer, but lifts values within `tolerance` of any
 * half-integer `n + 0.5` to `n + 1`. Used by `VertexCanonicalizer` to pick
 * the cluster integer for a new pre-round position.
 *
 * @private
 */
export function roundWithBoundaryTolerance(value: number, tolerance: number): number {
    const floor = Math.floor(value);
    const boundary = floor + 0.5;

    if (Math.abs(value - boundary) <= tolerance) {
        return Math.round(boundary);
    }

    return Math.round(value);
}

/**
 * Canonicalizes 2D scaled vertices into integer coordinates such that any two
 * inputs within `tolerance` in both x and y produce the same integer pair.
 * Used to collapse martinez precision noise — the same logical cut vertex
 * emitted as slightly different floats in different rings — into one integer
 * coord, eliminating rounding-rule discontinuities at `n + 0.5`.
 *
 * First-seen-wins: each new input either falls within `tolerance` of a prior
 * canonicalized vertex (and adopts its integer pair) or starts a new cluster
 * with its own `roundWithBoundaryTolerance` integer pair.
 *
 * @private
 */
export class VertexCanonicalizer {
    private readonly tolerance: number;
    // Parallel arrays for stored vertices — pre-round (xs/ys) and post-round
    // (ixs/iys) — indexed by a per-vertex id. Buckets hold ids, not objects,
    // so no per-vertex heap object is allocated.
    private readonly xs: number[] = [];
    private readonly ys: number[] = [];
    private readonly ixs: number[] = [];
    private readonly iys: number[] = [];
    // Spatial hash: nested numeric Maps for `bx -> by -> ids`. Bucket size is
    // `tolerance`, so any two points within Chebyshev distance `tolerance`
    // lie in the same or an adjacent cell — bounding the lookup to the 9
    // surrounding cells regardless of how many vertices have been seen.
    private readonly buckets: Map<number, Map<number, number[]>> = new Map();

    constructor(tolerance: number) {
        this.tolerance = tolerance;
    }

    canonicalize(x: number, y: number): [number, number] {
        const t = this.tolerance;
        const bx = Math.floor(x / t);
        const by = Math.floor(y / t);

        for (let dx = -1; dx <= 1; dx++) {
            const inner = this.buckets.get(bx + dx);
            if (!inner) continue;
            for (let dy = -1; dy <= 1; dy++) {
                const bucket = inner.get(by + dy);
                if (!bucket) continue;
                for (const id of bucket) {
                    if (Math.abs(this.xs[id] - x) <= t && Math.abs(this.ys[id] - y) <= t) {
                        const ix = this.ixs[id];
                        const iy = this.iys[id];
                        // Store this input as an alias so subsequent points
                        // within tolerance of it — but outside tolerance of
                        // the cluster's first representative — can still
                        // chain to the cluster's integer pair. Skip when the
                        // match is an exact duplicate (e.g., ring closures):
                        // no new chaining info, so the alias would be redundant.
                        if (this.xs[id] !== x || this.ys[id] !== y) {
                            this.store(x, y, ix, iy, bx, by);
                        }
                        return [ix, iy];
                    }
                }
            }
        }

        const ix = roundWithBoundaryTolerance(x, t);
        const iy = roundWithBoundaryTolerance(y, t);
        this.store(x, y, ix, iy, bx, by);
        return [ix, iy];
    }

    private store(x: number, y: number, ix: number, iy: number, bx: number, by: number): void {
        const id = this.xs.length;
        this.xs.push(x);
        this.ys.push(y);
        this.ixs.push(ix);
        this.iys.push(iy);

        let inner = this.buckets.get(bx);
        if (!inner) {
            inner = new Map();
            this.buckets.set(bx, inner);
        }
        let bucket = inner.get(by);
        if (!bucket) {
            bucket = [];
            inner.set(by, bucket);
        }
        bucket.push(id);
    }
}

function fromMultiPolygon(geometry: martinez.MultiPolygon, scale: number = 1.0, roundingTolerance?: number): Point[][][] {
    // Share one canonicalizer across all rings so close vertices in different
    // sub-polygons (e.g., the two sides of a cut) collapse to the same integer.
    const canonicalizer = roundingTolerance != null ? new VertexCanonicalizer(roundingTolerance) : null;
    return geometry.map(poly => poly.map((ring, ringIdx) => {
        const r = ring.map(p => {
            const x = p[0] * scale;
            const y = p[1] * scale;
            if (canonicalizer) {
                const [ix, iy] = canonicalizer.canonicalize(x, y);
                return new Point(ix, iy);
            }
            return new Point(Math.round(x), Math.round(y));
        });
        if (ringIdx > 0) {
            // Reverse holes
            r.reverse();
        }
        return r;
    }));
}
