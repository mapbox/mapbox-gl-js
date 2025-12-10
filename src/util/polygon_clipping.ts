import assert from 'assert';
import * as martinez from 'martinez-polygon-clipping';
import Point from '@mapbox/point-geometry';

import type {EdgeIterator} from '../../3d-style/elevation/elevation_feature';

export type ClippedPolygon = {
    polygon: Array<Array<Point>>;
    bounds: [Point, Point];
};

type PolygonArray = Array<Array<Array<Point>>>;

function clipPolygon(polygons: PolygonArray, clipAxis1: number, clipAxis2: number, axis: number): PolygonArray {
    const intersectX = (ring: Array<Point>, ax: number, ay: number, bx: number, by: number, x: number) => {
        ring.push(new Point(x, ay + (by - ay) * ((x - ax) / (bx - ax))));
    };
    const intersectY = (ring: Array<Point>, ax: number, ay: number, bx: number, by: number, y: number) => {
        ring.push(new Point(ax + (bx - ax) * ((y - ay) / (by - ay)), y));
    };

    const polygonsClipped = [];
    const intersect = axis === 0 ? intersectX : intersectY;
    for (const polygon of polygons) {
        const polygonClipped = [];
        for (const ring of polygon) {
            if (ring.length <= 2) {
                continue;
            }

            const clipped = [];
            for (let i = 0; i < ring.length - 1; i++) {
                const ax = ring[i].x;
                const ay = ring[i].y;
                const bx = ring[i + 1].x;
                const by = ring[i + 1].y;
                const a = axis === 0 ? ax : ay;
                const b = axis === 0 ? bx : by;
                if (a < clipAxis1) {
                    if (b > clipAxis1) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        intersect(clipped, ax, ay, bx, by, clipAxis1);
                    }
                } else if (a > clipAxis2) {
                    if (b < clipAxis2) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        intersect(clipped, ax, ay, bx, by, clipAxis2);
                    }
                } else {
                    clipped.push(ring[i]);
                }
                if (b < clipAxis1 && a >= clipAxis1) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    intersect(clipped, ax, ay, bx, by, clipAxis1);
                }
                if (b > clipAxis2 && a <= clipAxis2) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    intersect(clipped, ax, ay, bx, by, clipAxis2);
                }
            }

            let last = ring[ring.length - 1];
            const a = axis === 0 ? last.x : last.y;
            if (a >= clipAxis1 && a <= clipAxis2) {
                clipped.push(last);
            }
            if (clipped.length) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                last = clipped[clipped.length - 1];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (clipped[0].x !== last.x || clipped[0].y !== last.y) {
                    clipped.push(clipped[0]);
                }
                polygonClipped.push(clipped);
            }
        }
        if (polygonClipped.length) {
            polygonsClipped.push(polygonClipped);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return polygonsClipped;
}

export function gridSubdivision(
    polygons: PolygonArray,
    bounds: [Point, Point],
    gridSizeX: number,
    gridSizeY: number,
    padding: number | null | undefined = 0.0,
    splitFn: ((axis: number, min: number, max: number) => number) | null,
): Array<ClippedPolygon> {
    const outPolygons = [];

    if (!polygons.length || !gridSizeX || !gridSizeY) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return outPolygons;
    }

    const addResult = (clipped: PolygonArray, bounds: [Point, Point]) => {
        for (const polygon of clipped) {
            outPolygons.push({polygon, bounds});
        }
    };

    const hSplits = Math.ceil(Math.log2(gridSizeX));
    const vSplits = Math.ceil(Math.log2(gridSizeY));

    const initialSplits = hSplits - vSplits;

    const splits = [];
    for (let i = 0; i < Math.abs(initialSplits); i++) {
        splits.push(initialSplits > 0 ? 0 : 1);
    }

    for (let i = 0; i < Math.min(hSplits, vSplits); i++) {
        splits.push(0); // x
        splits.push(1); // y
    }

    let split = polygons;

    split = clipPolygon(split, bounds[0].y - padding, bounds[1].y + padding, 1);
    split = clipPolygon(split, bounds[0].x - padding, bounds[1].x + padding, 0);

    if (!split.length) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return outPolygons;
    }

    const stack = [];
    if (splits.length) {
        stack.push({polygons: split, bounds, depth: 0});
    } else {
        addResult(split, bounds);
    }

    while (stack.length) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const frame = stack.pop();

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        assert(frame.polygons.length > 0);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const depth = frame.depth;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const axis = splits[depth];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const bboxMin = frame.bounds[0];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const bboxMax = frame.bounds[1];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const splitMin = axis === 0 ? bboxMin.x : bboxMin.y;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const splitMax = axis === 0 ? bboxMax.x : bboxMax.y;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const splitMid = splitFn ? splitFn(axis, splitMin, splitMax) : 0.5 * (splitMin + splitMax);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const lclip = clipPolygon(frame.polygons, splitMin - padding, splitMid + padding, axis);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        const rclip = clipPolygon(frame.polygons, splitMid - padding, splitMax + padding, axis);

        if (lclip.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const bbMaxX = axis === 0 ? splitMid : bboxMax.x;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const bbMaxY = axis === 1 ? splitMid : bboxMax.y;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const bbMax = new Point(bbMaxX, bbMaxY);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const lclipBounds: [Point, Point] = [bboxMin, bbMax];

            if (splits.length > depth + 1) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                stack.push({polygons: lclip, bounds: lclipBounds, depth: depth + 1});
            } else {
                addResult(lclip, lclipBounds);
            }
        }

        if (rclip.length) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const bbMinX = axis === 0 ? splitMid : bboxMin.x;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const bbMinY = axis === 1 ? splitMid : bboxMin.y;

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            const bbMin = new Point(bbMinX, bbMinY);

            const rclipBounds = [bbMin, bboxMax];

            if (splits.length > depth + 1) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                stack.push({polygons: rclip, bounds: rclipBounds, depth: depth + 1});
            } else {
                // @ts-expect-error - TS2345 - Argument of type 'any[]' is not assignable to parameter of type '[Point, Point]'.
                addResult(rclip, rclipBounds);
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return outPolygons;
}

export function clip(subjectPolygon: Point[][], clipRing: Point[]): Point[][][] {
    const geom = toMultiPolygon(subjectPolygon);
    const clipGeom = toMultiPolygon([clipRing]);

    const polygons = martinez.intersection(geom, clipGeom) as martinez.MultiPolygon;
    if (polygons == null) return [];

    return fromMultiPolygon(polygons);
}

export function polygonSubdivision(subjectPolygon: Point[][], subdivisionEdges: EdgeIterator): Point[][][] {
    // Perform clipping temporarily in a 32bit space where few unit wide polygons are just
    // lines when scaled back to 16bit.
    const scale = 1 << 16;
    let polygons = toMultiPolygon(subjectPolygon, scale);

    const clipGeometry: martinez.Polygon[] = [];

    // Split the polygon using edges from the iterator
    for (; subdivisionEdges.valid(); subdivisionEdges.next()) {
        const [a, b] = subdivisionEdges.get();

        const ax = a.x * scale;
        const ay = a.y * scale;
        const bx = b.x * scale;
        const by = b.y * scale;

        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy);
        if (len === 0) continue;

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

    // Snap to grid of 128 in 32bit space to eliminate martinez precision errors.
    // This corresponds to ~0.002 tile units (128 / 65536) after scaling back.
    return fromMultiPolygon(polygons, 1 / scale, 128);
}

function toMultiPolygon(polygon: Point[][], scale: number = 1.0): martinez.MultiPolygon {
    return [polygon.map(ring => ring.map(p => [p.x * scale, p.y * scale]))];
}

/**
 * Converts martinez MultiPolygon geometry back to Point arrays.
 *
 * @param {martinez.MultiPolygon} geometry - The martinez MultiPolygon to convert
 * @param {number} scale - Scale factor to apply to coordinates (default 1.0)
 * @param {number} [gridSize] - Optional grid size for snapping coordinates before scaling.
 *                              When provided, coordinates are rounded to the nearest multiple
 *                              of this value before scaling. This helps eliminate floating-point
 *                              precision errors from the martinez library, ensuring that adjacent
 *                              polygon edges that should share vertices end up with identical
 *                              coordinates after conversion.
 * @returns {Point[][][]}
 * @private
 */
function fromMultiPolygon(geometry: martinez.MultiPolygon, scale: number = 1.0, gridSize?: number): Point[][][] {
    return geometry.map(poly => poly.map((ring, index) => {
        const r = ring.map(p => {
            let x = p[0];
            let y = p[1];

            if (gridSize) {
                x = Math.round(x / gridSize) * gridSize;
                y = Math.round(y / gridSize) * gridSize;
            }

            return new Point(x * scale, y * scale)._round();
        });
        if (index > 0) {
            // Reverse holes
            r.reverse();
        }
        return r;
    }));
}
