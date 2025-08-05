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
                        intersect(clipped, ax, ay, bx, by, clipAxis1);
                    }
                } else if (a > clipAxis2) {
                    if (b < clipAxis2) {
                        intersect(clipped, ax, ay, bx, by, clipAxis2);
                    }
                } else {
                    clipped.push(ring[i]);
                }
                if (b < clipAxis1 && a >= clipAxis1) {
                    intersect(clipped, ax, ay, bx, by, clipAxis1);
                }
                if (b > clipAxis2 && a <= clipAxis2) {
                    intersect(clipped, ax, ay, bx, by, clipAxis2);
                }
            }

            let last = ring[ring.length - 1];
            const a = axis === 0 ? last.x : last.y;
            if (a >= clipAxis1 && a <= clipAxis2) {
                clipped.push(last);
            }
            if (clipped.length) {
                last = clipped[clipped.length - 1];
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    splitFn: any,
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
        const frame = stack.pop();

        assert(frame.polygons.length > 0);

        const depth = frame.depth;
        const axis = splits[depth];

        const bboxMin = frame.bounds[0];
        const bboxMax = frame.bounds[1];

        const splitMin = axis === 0 ? bboxMin.x : bboxMin.y;
        const splitMax = axis === 0 ? bboxMax.x : bboxMax.y;

        const splitMid = splitFn ? splitFn(axis, splitMin, splitMax) : 0.5 * (splitMin + splitMax);

        const lclip = clipPolygon(frame.polygons, splitMin - padding, splitMid + padding, axis);
        const rclip = clipPolygon(frame.polygons, splitMid - padding, splitMax + padding, axis);

        if (lclip.length) {
            const bbMaxX = axis === 0 ? splitMid : bboxMax.x;
            const bbMaxY = axis === 1 ? splitMid : bboxMax.y;

            const bbMax = new Point(bbMaxX, bbMaxY);

            const lclipBounds: [Point, Point] = [bboxMin, bbMax];

            if (splits.length > depth + 1) {
                stack.push({polygons: lclip, bounds: lclipBounds, depth: depth + 1});
            } else {
                addResult(lclip, lclipBounds);
            }
        }

        if (rclip.length) {
            const bbMinX = axis === 0 ? splitMid : bboxMin.x;
            const bbMinY = axis === 1 ? splitMid : bboxMin.y;

            const bbMin = new Point(bbMinX, bbMinY);

            const rclipBounds = [bbMin, bboxMax];

            if (splits.length > depth + 1) {
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

    return fromMultiPolygon(polygons, 1 / scale);
}

function toMultiPolygon(polygon: Point[][], scale: number = 1.0): martinez.MultiPolygon {
    return [polygon.map(ring => ring.map(p => [p.x * scale, p.y * scale]))];
}

function fromMultiPolygon(geometry: martinez.MultiPolygon, scale: number = 1.0): Point[][][] {
    return geometry.map(poly => poly.map((ring, index) => {
        const r = ring.map(p => new Point(p[0] * scale, p[1] * scale).round());
        if (index > 0) {
            // Reverse holes
            r.reverse();
        }
        return r;
    }));
}
