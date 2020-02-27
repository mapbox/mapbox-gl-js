// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {log} from './handler_util';


function getCentroid(points) {
    const sum = new Point(0, 0);
    for (const point of points) {
        sum._add(point);
    }
    return sum.div(points.length);
}

export class SingleTapRecognizer {
    constructor(options) {
        this.reset();
        this.numTouches = options.numTouches;
        this.maxTouchTime = 300;
        this.maxDist = 30;
    }

    reset() {
        this.active = false;
        this.centroid = null;
        this.startTime = null;
        this.aborted = false;
    }

    touchstart(e, points) {

        if (this.centroid || e.targetTouches.length > this.numTouches) {
            this.aborted = true;
        }
        if (this.aborted) {
            return;
        }

        if (this.startTime === null) {
            this.startTime = Date.now();
        }

        if (e.targetTouches.length === this.numTouches) {
            this.centroid = getCentroid(points);
        }
    }

    touchmove(e, points) {
        if (this.aborted || !this.centroid) return;

        log(getCentroid(points).dist(this.centroid));
        if (getCentroid(points).dist(this.centroid) > this.maxDist) {
            this.aborted = true;
        }
    }

    touchend(e, points) {
        if (!this.centroid || Date.now() - this.startTime > this.maxTouchTime) {
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
    constructor(options) {
        this.singleTap = new SingleTapRecognizer(options);
        this.numTaps = options.numTaps;
        this.maxTapInterval = 300;
        this.maxDist = 30;
        this.reset();
    }

    reset() {
        this.lastTime = Infinity;
        this.lastTap = null;
        this.count = 0;
        this.singleTap.reset();
    }

    touchstart(e, points) {
        this.singleTap.touchstart(e, points);
    }

    touchmove(e, points) {
        this.singleTap.touchmove(e, points);
    }

    touchend(e, points) {
        const tap = this.singleTap.touchend(e, points);
        if (tap) {
            const now = Date.now();

            const soonEnough = now - this.lastTime < this.maxTapInterval;
            const closeEnough = !this.lastTap || this.lastTap.dist(tap) < this.maxDist;
            log('' + soonEnough + closeEnough + now + this.lastTime + this.maxTapInterval);

            if (!soonEnough || !closeEnough) {
                this.reset();
            }

            this.count++;
            this.lastTime = now;
            this.lastTap = tap;

            if (this.count === this.numTaps) {
                this.reset();
                return tap;
            }
        }
    }
}
