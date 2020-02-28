// @flow

import Point from '@mapbox/point-geometry';
import {getTouchesById} from './handler_util';

export default class TouchZoomHandler {

    _enabled: boolean;
    _active: boolean;
    _firstTwoTouches: [number, number];
    _vector: Point;

    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
        delete this._firstTwoTouches;
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        if (this._firstTwoTouches || e.targetTouches.length < 2) return;

        this._firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);
        this._vector = a.sub(b);
    }

    touchmove(e: TouchEvent, points: Array<Point>) {
        if (!this._firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);
        const vector = a.sub(b);
        const bearingDelta = vector.angleWith(this._vector) * 180 / Math.PI;
        const around = a.add(b).div(2);

        this._vector = vector;

        this._active = true;

        return {
            transform: {
                around,
                bearingDelta
            }
        };
    }

    touchend(e: TouchEvent, points: Array<Point>) {
        if (!this._firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);
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
