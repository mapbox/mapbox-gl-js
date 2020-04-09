// @flow

import {TapRecognizer} from './tap_recognizer';
import type Point from '@mapbox/point-geometry';
import type Map from '../map';

export default class TapZoomHandler {

    _enabled: boolean;
    _active: boolean;
    _zoomIn: TapRecognizer;
    _zoomOut: TapRecognizer;

    constructor() {
        this._zoomIn = new TapRecognizer({
            numTouches: 1,
            numTaps: 2
        });

        this._zoomOut = new TapRecognizer({
            numTouches: 2,
            numTaps: 1
        });

        this.reset();
    }

    reset() {
        this._active = false;
        this._zoomIn.reset();
        this._zoomOut.reset();
    }

    touchstart(e: TouchEvent, points: Array<Point>) {
        this._zoomIn.touchstart(e, points);
        this._zoomOut.touchstart(e, points);
    }

    touchmove(e: TouchEvent, points: Array<Point>) {
        this._zoomIn.touchmove(e, points);
        this._zoomOut.touchmove(e, points);
    }

    touchend(e: TouchEvent) {
        const zoomInPoint = this._zoomIn.touchend(e);
        const zoomOutPoint = this._zoomOut.touchend(e);

        if (zoomInPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map: Map) => map.easeTo({
                    duration: 300,
                    zoom: map.getZoom() + 1,
                    around: map.unproject(zoomInPoint)
                }, {originalEvent: e})
            };
        } else if (zoomOutPoint) {
            this._active = true;
            e.preventDefault();
            setTimeout(() => this.reset(), 0);
            return {
                cameraAnimation: (map: Map) => map.easeTo({
                    duration: 300,
                    zoom: map.getZoom() - 1,
                    around: map.unproject(zoomOutPoint)
                }, {originalEvent: e})
            };
        }
    }

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

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
