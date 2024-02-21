// @flow

import {TapRecognizer, MAX_TAP_INTERVAL} from './tap_recognizer.js';
import type Point from '@mapbox/point-geometry';
import type {Handler, HandlerResult} from '../handler.js';

export default class TapDragZoomHandler implements Handler {
    _enabled: boolean;
    _active: boolean;
    _swipePoint: ?Point;
    _swipeTouch: number;
    _tapTime: number;
    _tap: TapRecognizer;

    constructor() {

        this._tap = new TapRecognizer({
            numTouches: 1,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this._active = false;
        this._swipePoint = undefined;
        this._swipeTouch = 0;
        this._tapTime = 0;
        this._tap.reset();
    }

    // $FlowFixMe[method-unbinding]
    touchstart(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (this._swipePoint) return;

        if (this._tapTime && e.timeStamp - this._tapTime > MAX_TAP_INTERVAL) {
            this.reset();
        }

        if (!this._tapTime) {
            this._tap.touchstart(e, points, mapTouches);
        } else if (mapTouches.length > 0) {
            this._swipePoint = points[0];
            this._swipeTouch = mapTouches[0].identifier;
        }

    }

    // $FlowFixMe[method-unbinding]
    touchmove(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>): ?HandlerResult {
        if (!this._tapTime) {
            this._tap.touchmove(e, points, mapTouches);
        } else if (this._swipePoint) {
            if (mapTouches[0].identifier !== this._swipeTouch) {
                return;
            }

            const newSwipePoint = points[0];
            const dist = newSwipePoint.y - this._swipePoint.y;
            this._swipePoint = newSwipePoint;

            e.preventDefault();
            this._active = true;

            return {
                zoomDelta: dist / 128
            };
        }
    }

    // $FlowFixMe[method-unbinding]
    touchend(e: TouchEvent, points: Array<Point>, mapTouches: Array<Touch>) {
        if (!this._tapTime) {
            const point = this._tap.touchend(e, points, mapTouches);
            if (point) {
                this._tapTime = e.timeStamp;
            }
        } else if (this._swipePoint) {
            if (mapTouches.length === 0) {
                this.reset();
            }
        }
    }

    // $FlowFixMe[method-unbinding]
    touchcancel() {
        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
        this.reset();
    }

    isEnabled(): boolean {
        return this._enabled;
    }

    isActive(): boolean {
        return this._active;
    }
}
