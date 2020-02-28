// @flow

import Point from '@mapbox/point-geometry';
import {log, indexTouches} from './handler_util';

export default class TouchPanHandler {

    _enabled: boolean;
    _active: boolean;
    _touches: { [number]: Point };
    _minTouches: number;
    
    constructor() {
        this._minTouches = 1;
        this.reset();
    }

    reset() {
        this._active = false;
        this._touches = {};
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        return {
            transform: this._calculateTransform(e, points)
        };
    }

    touchmove(e: TouchEvent, points: Array<Point>) {
        return {
            transform: this._calculateTransform(e, points)
        };
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
