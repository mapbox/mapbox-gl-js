// @flow

import Point from '@mapbox/point-geometry';
import {log, indexTouches} from './handler_util';
import type InertiaOptions from '../handler_inertia';

export default class TouchPanHandler {

    _enabled: boolean;
    _active: boolean;
    _touches: { [string | number]: Point };
    _minTouches: number;
    _options: InertiaOptions;
    
    constructor() {
        this._minTouches = 1;
        this.reset();
    }

    reset() {
        this._active = false;
        this._touches = {};
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        return this._calculateTransform(e, points)
    }

    touchmove(e: TouchEvent, points: Array<Point>) {
        return this._calculateTransform(e, points)
    }

    touchend(e: TouchEvent, points: Array<Point>) {
        const transform = this._calculateTransform(e, points);

        if (this._active && e.targetTouches.length < this._minTouches) {
            this.reset();
        }
    }

    _calculateTransform(e: TouchEvent, points: Array<Point>) {
        const touches = indexTouches(e.targetTouches, points);

        const touchPointSum = new Point(0, 0);
        const touchDeltaSum = new Point(0, 0);
        let touchDeltaCount = 0;

        for (const identifier in touches) {
            const point = touches[identifier];
            const prevPoint = this._touches[identifier];
            if (prevPoint) {
                touchPointSum._add(point);
                touchDeltaSum._add(point.sub(prevPoint));
                touchDeltaCount++;
                touches[identifier] = point;
            }
        }

        this._touches = touches;

        if (touchDeltaCount < this._minTouches || !touchDeltaSum.mag()) return;

        const panDelta = touchDeltaSum.div(touchDeltaCount);
        const around = touchPointSum.div(touchDeltaCount);

        this._active = true;

        return {
            around,
            panDelta
        };
    }

    enable(options?: InertiaOptions) {
        this._enabled = true;
        if (!!options) this._options = options;
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
