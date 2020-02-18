// @flow

import Handler from './handler';
import type Map from '../map';
import Point from '@mapbox/point-geometry';
import {log, indexTouches} from './handler_util';

export default class TouchPanHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        super(map, options);
        this.minTouches = 1;
        this.reset();
    }

    touchstart(e, points) {
        const transform = this._calculateTransform(e, points);

        let events;
        if (!this.active && e.targetTouches.length >= this.minTouches) {
            events = ['dragstart'];
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
        if (this.active && e.targetTouches.length < this.minTouches) {
            this.reset();
            events = ['dragend'];
            return {};
        }
        log('end ' + e.targetTouches.length);

        return {
            events
        };
    }

    reset(transform) {
        this.active = false;
        this.touches = {};
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
}
