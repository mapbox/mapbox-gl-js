// @flow

import DOM from '../../util/dom';
import type Point from '@mapbox/point-geometry';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export default class MousePitchHandler {

    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _eventButton: number;
    _clickTolerance: number;

    constructor(options: { clickTolerance?: number }) {
        this.reset();
        this._clickTolerance = options.clickTolerance || 1;
    }

    reset() {
        this._active = false;
        delete this._lastPoint;
        delete this._eventButton;
    }

    mousedown(e: MouseEvent, point: Point) {
        if (this._lastPoint) return;

        const eventButton = DOM.mouseButton(e);
        if (eventButton !== LEFT_BUTTON && eventButton !== RIGHT_BUTTON) return;
        if (eventButton === LEFT_BUTTON && !e.ctrlKey) return;

        this._lastPoint = point;
        this._eventButton = eventButton;
    }

    mousemove(e: MouseEvent, point: Point) {
        if (!this._lastPoint) return;

        const yDelta = this._lastPoint.y - point.y;
        if (Math.abs(yDelta) < this._clickTolerance) return 

        this._active = true;

        const pitchDelta = yDelta * 0.5;
        this._lastPoint = point;

        return {
            pitchDelta
        };
    }

    mouseup(e: MouseEvent, point: Point) {
        const eventButton = DOM.mouseButton(e);
        if (this._eventButton !== eventButton) return;
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
