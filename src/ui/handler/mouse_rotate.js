// @flow

import type Map from '../map';
import DOM from '../../util/dom';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export default class MouseRotateHandler  {

    _enabled: boolean;
    _active: boolean;
    _lastPoint: Point;
    _eventButton: number;
    _clickTolerance: boolean;

    constructor(options: { clickTolerance?: boolean }) {
        this._clickTolerance = options.clickTolerance || 1;
        this.reset();
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

        const xDelta = this._lastPoint.x - point.x;

        if (Math.abs(xDelta) < this._clickTolerance) return;

        this._active = true;
        const bearingDelta = (this._lastPoint.x - point.x) * -0.8;
        this._lastPoint = point;

        return {
            bearingDelta
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
