import assert from 'assert';
import Point from '@mapbox/point-geometry';
import {number as interpolate} from '../style-spec/util/interpolate';

export class Point3D extends Point {
    z: number;

    constructor(x: number, y: number, z: number) {
        super(x, y);
        this.z = z;
    }
}

export class Point4D extends Point3D {
    w: number; // used for line progress and interpolated on clipping

    constructor(x: number, y: number, z: number, w: number) {
        super(x, y, z);
        this.w = w;
    }
}

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

    return polygonsClipped;
}

export function subdividePolygons(
    polygons: PolygonArray,
    bounds: [Point, Point],
    gridSizeX: number,
    gridSizeY: number,
    padding: number | null | undefined = 0.0,
    splitFn: any,
): Array<ClippedPolygon> {
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
                // @ts-expect-error - TS2345 - Argument of type 'any[]' is not assignable to parameter of type '[Point, Point]'.
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

    return outPolygons;
}

function clipFirst(a: Point, b: Point, axis: string, clip: number): void {
    const axis1 = axis === 'x' ? 'y' : 'x';
    const ratio = (clip - a[axis]) / (b[axis] - a[axis]);
    a[axis1] = a[axis1] + (b[axis1] - a[axis1]) * ratio;
    a[axis] = clip;
    if (a.hasOwnProperty('z')) {
        a['z'] = interpolate(a['z'], b['z'], ratio);
    }
    if (a.hasOwnProperty('w')) {
        a['w'] = interpolate(a['w'], b['w'], ratio);
    }
}

export function clipLine(p0: Point, p1: Point, boundsMin: number, boundsMax: number): void {
    const clipAxis1 = boundsMin;
    const clipAxis2 = boundsMax;
    for (const axis of ["x", "y"]) {
        let a = p0;
        let b = p1;
        if (a[axis] >= b[axis]) {
            a = p1;
            b = p0;
        }

        if (a[axis] < clipAxis1 && b[axis] > clipAxis1) {
            clipFirst(a, b, axis, clipAxis1);
        }
        if (a[axis] < clipAxis2 && b[axis] > clipAxis2) {
            clipFirst(b, a, axis, clipAxis2);
        }
    }
}
