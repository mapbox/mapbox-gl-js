// @flow

import Handler from './handler';
import type Map from '../map';
import Point from '@mapbox/point-geometry';
import {indexTouches} from './handler_util';

export default class TouchPanHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        super(map, options);
        this.touches = {};
        this.minTouches = 1;
    }

    touchstart(e, points) {
        const transform = this._calculateTransform(e, points);

        let events;
        if (!this.yep && e.targetTouches.length >= this.minTouches) {
            events = ['dragstart'];
            this.yep = true;
        }

        return {
            transform,
            events
        };
    }

    touchmove(e, points) {
        const transform = this._calculateTransform(e, points);
        return {
            transform
        };
    }

    touchend(e, points) {
        const transform = this._calculateTransform(e, points);

        let events;
        if (this.yep && e.targetTouches.length < this.minTouches) {
            this.yep = false;
            events = ['dragend'];
        }

        return {
            transform,
            events
        };
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

        if (touchDeltaCount < this.minTouches && touchDeltaSum.mag()) return;

        const panDelta = touchDeltaSum.div(touchDeltaCount);
        const around = touchPointSum.div(touchDeltaCount);

        return {
            around,
            panDelta
        };
    }
}
