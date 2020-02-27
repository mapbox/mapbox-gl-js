// @flow

import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {getTouchesById} from './handler_util';

export default class TouchZoomHandler {

    constructor() {
        this.reset();
    }

    reset() {
        this.firstTwoTouches = null;
        this._active = false;
    }

    touchstart(e, points) {
        if (this.firstTwoTouches || e.targetTouches.length < 2) return;

        this.firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches);
        this.distance = a.dist(b);
    }

    touchmove(e, points) {

        if (!this.firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this.firstTwoTouches)
        if (!a || !b) return;

        const distance = a.dist(b);
        const zoomDelta = Math.log(distance / this.distance) / Math.LN2;
        const around = a.add(b).div(2);

        this.distance = distance;

        this._active = true;

        return {
            transform: {
                around,
                zoomDelta
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
