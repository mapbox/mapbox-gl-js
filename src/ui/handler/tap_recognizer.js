// @flow

import Point from '@mapbox/point-geometry';
import {log} from './handler_util';


function getCentroid(points: Array<Point>) {
    const sum = new Point(0, 0);
    for (const point of points) {
        sum._add(point);
    }
    return sum.div(points.length);
}

const MAX_TAP_INTERVAL = 300;
const MAX_TOUCH_TIME = 300;
const MAX_DIST = 30;

export class SingleTapRecognizer {

    numTouches: number;
    centroid: Point;
    startTime: number;
    aborted: boolean;

    constructor(options: { numTouches: number }) {
        this.reset();
        this.numTouches = options.numTouches;
    }

    reset() {
        delete this.centroid;
        delete this.startTime;
        this.aborted = false;
    }

    touchstart(e: TouchEvent, points: Array<Point>) {

        if (this.centroid || e.targetTouches.length > this.numTouches) {
            this.aborted = true;
        }
        if (this.aborted) {
            return;
        }

        if (this.startTime === undefined) {
            this.startTime = e.timeStamp;
        }

        if (e.targetTouches.length === this.numTouches) {
            this.centroid = getCentroid(points);
        }
    }

    touchmove(e: TouchEvent, points: Array<Point>) {
        if (this.aborted || !this.centroid) return;

        if (getCentroid(points).dist(this.centroid) > MAX_DIST) {
            this.aborted = true;
        }
    }

    touchend(e: TouchEvent, points: Array<Point>) {
        if (!this.centroid || e.timeStamp - this.startTime > MAX_TOUCH_TIME) {
            this.aborted = true;
        }

        if (e.targetTouches.length === 0) {
            const centroid = !this.aborted && this.centroid;
            this.reset();
            if (centroid) return centroid;
        }
    }

}

export class TapRecognizer {

    singleTap: SingleTapRecognizer;
    numTaps: number;
    lastTime: number;
    lastTap: Point;
    count: number;

    constructor(options: { numTaps: number, numTouches: number }) {
        this.singleTap = new SingleTapRecognizer(options);
        this.numTaps = options.numTaps;
        this.reset();
    }

    reset() {
        this.lastTime = Infinity;
        delete this.lastTap;
        this.count = 0;
        this.singleTap.reset();
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        this.singleTap.touchstart(e, points);
    }

    touchmove(e: TouchEvent, points: Array<Point>) {
        this.singleTap.touchmove(e, points);
    }

    touchend(e: TouchEvent, points: Array<Point>) {
        const tap = this.singleTap.touchend(e, points);
        if (tap) {
            const soonEnough = e.timeStamp - this.lastTime < MAX_TAP_INTERVAL;
            const closeEnough = !this.lastTap || this.lastTap.dist(tap) < MAX_DIST;

            if (!soonEnough || !closeEnough) {
                this.reset();
            }

            this.count++;
            this.lastTime = e.timeStamp;
            this.lastTap = tap;

            if (this.count === this.numTaps) {
                this.reset();
                return tap;
            }
        }
    }
}
