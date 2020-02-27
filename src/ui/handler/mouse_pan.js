// @flow

import type Map from '../map';
import DOM from '../../util/dom';

const LEFT_BUTTON = 0;

export default class MousePanHandler {

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
        if (eventButton !== LEFT_BUTTON || e.ctrlKey) {
            return;
        }

        this._lastPoint = point;
        this._eventButton = eventButton;
    }

    mousemove(e, point) {
        if (!this._lastPoint) return;

        this._active = true;

        const panDelta = point.sub(this._lastPoint);
        this._lastPoint = point;

        return {
            transform: {
                around: point,
                panDelta
            }
        };
    }

    mouseup(e, point) {
        const eventButton = DOM.mouseButton(e);
        if (eventButton !== this._eventButton) return;
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
