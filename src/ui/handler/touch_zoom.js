// @flow

import DOM from '../../util/dom';
import Point from '@mapbox/point-geometry';
import {getTouchesById} from './handler_util';

export default class TouchZoomHandler {

    _enabled: boolean;
    _active: boolean;
    _firstTwoTouches: [number, number];
    _distance: number;
    _aroundCenter: boolean;

    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
        delete this._firstTwoTouches;
        delete this._distance;
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        if (this._firstTwoTouches || e.targetTouches.length < 2) return;

        this._firstTwoTouches = [
            e.targetTouches[0].identifier,
            e.targetTouches[1].identifier
        ];

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);
        this._distance = a.dist(b);
    }

    touchmove(e: TouchEvent, points: Array<Point>) {

        if (!this._firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches)
        if (!a || !b) return;

        const distance = a.dist(b);
        const zoomDelta = Math.log(distance / this._distance) / Math.LN2;
        const pinchAround = this._aroundCenter ? null : a.add(b).div(2);

        this._distance = distance;

        this._active = true;

        return {
            pinchAround,
            zoomDelta
        };
    }

    touchend(e: TouchEvent, points: Array<Point>) {
        if (!this._firstTwoTouches) return;

        const [a, b] = getTouchesById(e, points, this._firstTwoTouches);
        if (a && b) return;

        this.reset();
    }

    enable(options: ?{around?: 'center'}) {
        this._enabled = true;
        this._aroundCenter = !!options && options.around === 'center';
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
