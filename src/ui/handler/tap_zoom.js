// @flow

import {TapRecognizer} from './tap_recognizer';

export default class TapZoomHandler {

    constructor() {

        this.zoomIn = new TapRecognizer({
            numTouches: 1,
            numTaps: 2
        });

        this.zoomOut = new TapRecognizer({
            numTouches: 2,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this._active = false;
        this.zoomIn.reset();
        this.zoomOut.reset();
    }

    touchstart(e, points) {
        this.zoomIn.touchstart(e, points);
        this.zoomOut.touchstart(e, points);
    }

    touchmove(e, points) {
        this.zoomIn.touchmove(e, points);
        this.zoomOut.touchmove(e, points);
    }

    touchend(e, points) {
        const zoomInPoint = this.zoomIn.touchend(e, points);
        const zoomOutPoint = this.zoomOut.touchend(e, points);

        if (zoomInPoint) {
            this._active = true;
            return {
                transform: {
                    duration: 300,
                    zoomDelta: 1,
                    around: zoomInPoint
                }
            };
            setTimeout(() => this.reset(), 0);
        } else if (zoomOutPoint) {
            this._active = true;
            return {
                transform: {
                    duration: 300,
                    zoomDelta: -1,
                    around: zoomOutPoint
                }
            };
            setTimeout(() => this.reset(), 0);
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
