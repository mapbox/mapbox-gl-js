// @flow

import {TapRecognizer} from './tap_recognizer';
import {log} from './handler_util';

export default class TapZoomHandler {

    constructor() {

        this.tap = new TapRecognizer({
            numTouches: 1,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this._active = false;
        this.swipePoint = null;
        this.swipeTime = null;
        this.tapTime = null;
        this.tap.reset();
    }

    touchstart(e, points) {
        if (this.swipePoint) return;

        if (this.tapTime && e.timeStamp - this.tapTime > 300) {
            this.reset();
        }

        if (!this.tapTime) {
            this.tap.touchstart(e, points);
        } else if (e.targetTouches.length > 0) {
            this.swipePoint = points[0];
            this.swipeTouch = e.targetTouches[0].identifier;
        } else {
            log(e.targetTouches.length);
        }

    }

    touchmove(e, points) {
        if (!this.tapTime) {
            this.tap.touchmove(e, points);
        } else if (this.swipePoint) {
            if (e.targetTouches[0].identifier !== this.swipeTouch) {
                return;
            }

            const newSwipePoint = points[0];
            const dist = newSwipePoint.y - this.swipePoint.y;
            this.swipePoint = newSwipePoint;

            this._active = true;

            return {
                transform: {
                    zoomDelta: dist / -128
                }
            }
        }
    }

    touchend(e, points) {
        if (!this.tapTime) {
            const point = this.tap.touchend(e, points);;
            if (point) {
                this.tapTime = e.timeStamp;
            }
        } else if (this.swipePoint) {
            if (e.targetTouches.length === 0) {
                this.reset();
            }
        }
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
