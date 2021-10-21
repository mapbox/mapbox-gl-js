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
export default function resample(line: Array<Point>, reproject: (Point) => Point, tolerance: number): Array<Point> {
    const resampled = [];
    let mx0, my0, prev;

    for (const point of line) {
        const {x, y} = point;
        reproject(point);

        if (prev) {
            addResampled(resampled, mx0, my0, x, y, prev, point, reproject, tolerance);
        } else {
            resampled.push(point);
        }

        mx0 = x;
        my0 = y;
        prev = point;
    }

    return resampled;
}
