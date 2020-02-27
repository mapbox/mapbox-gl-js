// @flow

import Point from '@mapbox/point-geometry';
import {log, indexTouches} from './handler_util';

export default class TouchPanHandler {

    constructor() {
        this.minTouches = 1;
        this.reset();
    }

    reset(transform) {
        this._active = false;
        this.touches = {};
    }

    touchstart(e, points) {
        return {
            transform: this._calculateTransform(e, points)
        };
    }

    touchmove(e, points) {
        return {
            transform: this._calculateTransform(e, points)
        };
    }

    touchend(e, points) {
        const transform = this._calculateTransform(e, points);

        if (this._active && e.targetTouches.length < this.minTouches) {
            this.reset();
        }
    }

    _calculateTransform(e, points) {
        const touches = indexTouches(e.targetTouches, points);

        const touchPointSum = new Point(0, 0);
        const touchDeltaSum = new Point(0, 0);
        let touchDeltaCount = 0;

        for (const identifier in touches) {
            const point = touches[identifier];
            const prevPoint = this.touches[identifier];
            if (prevPoint) {
                touchPointSum._add(point);
                touchDeltaSum._add(point.sub(prevPoint));
                touchDeltaCount++;
                touches[identifier] = point;
            }
        }

        this.touches = touches;

        if (touchDeltaCount < this.minTouches || !touchDeltaSum.mag()) return;

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
