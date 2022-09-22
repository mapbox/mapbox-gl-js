// @flow

import Point from '@mapbox/point-geometry';

function pointToLineDist(px, py, ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.abs((ay - py) * dx - (ax - px) * dy) / Math.hypot(dx, dy);
}

function addResampled(resampled, mx0, my0, mx2, my2, start, end, reproject, tolerance) {
    const mx1 = (mx0 + mx2) / 2;
    const my1 = (my0 + my2) / 2;
    const mid = new Point(mx1, my1);
    reproject(mid);
    const err = pointToLineDist(mid.x, mid.y, start.x, start.y, end.x, end.y);

    // if reprojected midPoint is too far from geometric midpoint, recurse into two halves
    if (err >= tolerance) {
        // we're very unlikely to hit max call stack exceeded here,
        // but we might want to safeguard against it in the future
        addResampled(resampled, mx0, my0, mx1, my1, start, mid, reproject, tolerance);
        addResampled(resampled, mx1, my1, mx2, my2, mid, end, reproject, tolerance);

    } else { // otherwise, just add the point
        resampled.push(end);
    }
}

// reproject and resample a line, adding point where necessary for lines that become curves;
// note that this operation is mutable (modifying original points) for performance
export default function resample(line: Array<Point>, reproject: (Point) => void, tolerance: number): Array<Point> {
    let prev = line[0];
    let mx0 = prev.x;
    let my0 = prev.y;
    reproject(prev);
    const resampled = [prev];

    for (let i = 1; i < line.length; i++) {
        const point = line[i];
        const {x, y} = point;
        reproject(point);
        addResampled(resampled, mx0, my0, x, y, prev, point, reproject, tolerance);
        mx0 = x;
        my0 = y;
        prev = point;
    }

    return resampled;
}

function addResampledPred(resampled: Point[], a: Point, b: Point, pred) {
    const split = pred(a, b);

    // if the predicate condition is met, recurse into two halves
    if (split) {
        const mid = a.add(b)._mult(0.5);
        addResampledPred(resampled, a, mid, pred);
        addResampledPred(resampled, mid, b, pred);

    } else {
        resampled.push(b);
    }
}

export function resamplePred(line: Point[], predicate: (Point, Point) => boolean): Point[] {
    let prev = line[0];
    const resampled = [prev];

    for (let i = 1; i < line.length; i++) {
        const point = line[i];
        addResampledPred(resampled, prev, point, predicate);
        prev = point;
    }

    return resampled;
}
