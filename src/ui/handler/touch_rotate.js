// @flow

import Point from '@mapbox/point-geometry';
import {getTouchesById} from './handler_util';

export default class TouchZoomHandler {

    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
        this.firstTwoTouches = null;
    }

    touchstart(e, points) {
        if (this.firstTwoTouches || e.targetTouches.length < 2) return;

        this.firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        this.vector = a.sub(b);
    }

    touchmove(e, points) {
        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        const vector = a.sub(b);
        const bearingDelta = vector.angleWith(this.vector) * 180 / Math.PI;
        const around = a.add(b).div(2);

        this.vector = vector;

        this._active = true;

        return {
            transform: {
                around,
                bearingDelta
            }
        };
    }

    touchend(e, points) {
        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        if (a && b) return;

        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
