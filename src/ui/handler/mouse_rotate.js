// @flow

import type Map from '../map';
import DOM from '../../util/dom';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export default class MouseRotateHandler  {

    constructor(el, manager) {
        this.reset();
    }

    reset() {
        this._active = false;
        this._lastPoint = null;
        this._eventButton = null;
    }

    mousedown(e, point) {
        if (this._lastPoint !== null) return;

        const eventButton = DOM.mouseButton(e);
        if (eventButton !== LEFT_BUTTON && eventButton !== RIGHT_BUTTON) return;
        if (eventButton === LEFT_BUTTON && !e.ctrlKey) return;

        this._lastPoint = point;
        this._eventButton = eventButton;
    }

    mousemove(e, point) {
        if (!this._lastPoint) return;

        this._active = true;

        const bearingDelta = (this._lastPoint.x - point.x) * -0.8;
        this._lastPoint = point;

        return {
            transform: {
                bearingDelta
            }
        };
    }

    mouseup(e, point) {
        const eventButton = DOM.mouseButton(e);
        if (this._eventButton !== eventButton) return;
        this.reset();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._disabled = true;
        this.reset();
    }

    isEnabled() {
        return this._enabled;
    }

    isActive() {
        return this._active;
    }
}
