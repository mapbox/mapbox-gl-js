// @flow

import assert from 'assert';
import Point from '@mapbox/point-geometry';

export type ClippedPolygon = {
    polygon: Array<Array<Point>>,
    bounds: [Point, Point]
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

    return polygonsClipped;
}

export function subdividePolygons(polygons: PolygonArray, bounds: [Point, Point], gridSizeX: number, gridSizeY: number, padding: number = 0.0, splitFn: Function): Array<ClippedPolygon> {
    const outPolygons = [];

    if (!polygons.length || !gridSizeX || !gridSizeY) {
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

            const lclipBounds = [bboxMin, bbMax];

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
                addResult(rclip, rclipBounds);
            }
        }
    }

    return outPolygons;
}
