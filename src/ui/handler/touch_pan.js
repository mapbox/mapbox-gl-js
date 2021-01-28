// @flow

import Point from '@mapbox/point-geometry';
import {indexTouches} from './handler_util.js';

export default class TouchPanHandler {

    _enabled: boolean;
    _active: boolean;
    _touches: { [string | number]: Point };
    _minTouches: number;
    _clickTolerance: number;
    _sum: Point;

    constructor(options: { clickTolerance: number }) {
        this._minTouches = 1;
        this._clickTolerance = options.clickTolerance || 1;
        this.reset();
    }

    reset() {
        this._active = false;
        this._touches = {};
        this._sum = new Point(0, 0);
    }

    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        return this._calculateTransform(e, points, mapTouches);
    }

    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._active || mapTouches.length < this._minTouches) return;
        e.preventDefault();
        return this._calculateTransform(e, points, mapTouches);
    }

    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        this._calculateTransform(e, points, mapTouches);

        if (this._active && mapTouches.length < this._minTouches) {
            this.reset();
        }
    }

    touchcancel() {
        this.reset();
    }

    _calculateTransform(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (mapTouches.length > 0) this._active = true;

        const touches = indexTouches(mapTouches, points);

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
        this._sum._add(panDelta);
        if (this._sum.mag() < this._clickTolerance) return;

        const around = touchPointSum.div(touchDeltaCount);

        return {
            around,
            panDelta
        };
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
