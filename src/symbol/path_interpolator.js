// @flow

import {clamp} from '../util/util.js';
import Point from '@mapbox/point-geometry';
import assert from 'assert';

class PathInterpolator {
    points: Array<Point>;
    length: number;
    paddedLength: number;
    padding: number;
    _distances: Array<number>;

    constructor(points_: ?Array<Point>, padding_: ?number) {
        this.reset(points_, padding_);
    }

    reset(points_: ?Array<Point>, padding_: ?number) {
        this.points = points_ || [];

        // Compute cumulative distance from first point to every other point in the segment.
        // Last entry in the array is total length of the path
        this._distances = [0.0];

        for (let i = 1; i < this.points.length; i++) {
            this._distances[i] = this._distances[i - 1] + this.points[i].dist(this.points[i - 1]);
        }

        this.length = this._distances[this._distances.length - 1];
        this.padding = Math.min(padding_ || 0, this.length * 0.5);
        this.paddedLength = this.length - this.padding * 2.0;
    }

    lerp(t: number): Point {
        assert(this.points.length > 0);
        if (this.points.length === 1) {
            return this.points[0];
        }

        t = clamp(t, 0, 1);

        // Find the correct segment [p0, p1] where p0 <= x < p1
        let currentIndex = 1;
        let distOfCurrentIdx = this._distances[currentIndex];
        const distToTarget = t * this.paddedLength + this.padding;

        while (distOfCurrentIdx < distToTarget && currentIndex < this._distances.length) {
            distOfCurrentIdx = this._distances[++currentIndex];
        }

        // Interpolate between the two points of the segment
        const idxOfPrevPoint = currentIndex - 1;
        const distOfPrevIdx = this._distances[idxOfPrevPoint];
        const segmentLength = distOfCurrentIdx - distOfPrevIdx;
        const segmentT = segmentLength > 0 ? (distToTarget - distOfPrevIdx) / segmentLength : 0;

        return this.points[idxOfPrevPoint].mult(1.0 - segmentT).add(this.points[currentIndex].mult(segmentT));
    }
}

export default PathInterpolator;
