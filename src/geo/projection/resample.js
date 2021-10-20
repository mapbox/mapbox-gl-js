// @flow

import Point from '@mapbox/point-geometry';

function pointToLineDist(px, py, ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.abs((ay - py) * dx - (ax - px) * dy) / Math.hypot(dx, dy);
}

function addResampled(resampled, startMerc, endMerc, startProj, endProj, reproject, tolerance) {
    const midMerc = new Point(
        (startMerc.x + endMerc.x) / 2,
        (startMerc.y + endMerc.y) / 2);

    const midProj = reproject(midMerc);
    const err = pointToLineDist(midProj.x, midProj.y, startProj.x, startProj.y, endProj.x, endProj.y);

    // if reprojected midPoint is too far from geometric midpoint, recurse into two halves
    if (err >= tolerance) {
        // we're very unlikely to hit max call stack exceeded here,
        // but we might want to safeguard against it in the future
        addResampled(resampled, startMerc, midMerc, startProj, midProj, reproject, tolerance);
        addResampled(resampled, midMerc, endMerc, midProj, endProj, reproject, tolerance);

    } else { // otherwise, just add the point
        resampled.push(endProj);
    }
}

export default function resample(line: Array<Point>, reproject: (Point) => Point, tolerance: number): Array<Point> {
    const resampled = [];
    let prevMerc, prevProj;

    for (const pointMerc of line) {
        const pointProj = reproject(pointMerc);

        if (prevMerc && prevProj) {
            addResampled(resampled, prevMerc, pointMerc, prevProj, pointProj, reproject, tolerance);
        } else {
            resampled.push(pointProj);
        }

        prevMerc = pointMerc;
        prevProj = pointProj;
    }

    return resampled;
}
