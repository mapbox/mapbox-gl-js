// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';

const LEFT_BUTTON = 0;

export default class MousePanHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        this.manager = manager;
        super(map, options);
        this.reset();
    }

    reset() {
        this.active = false;
        this._lastPoint = null;
    }

    _correctButton(e) {
        const eventButton = DOM.mouseButton(e);
        return eventButton === LEFT_BUTTON && !e.ctrlKey;
    }

    mousedown(e, point) {
        if (!this._correctButton(e)) return;

        this._lastPoint = point;
        return {
            events: ['dragstart']
        }
    }

    mousemove(e, point) {
        if (!this._lastPoint) return;

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
        if (!this._correctButton(e)) return;

        this.reset();
        return {
            events: ['dragend']
        }
    }
}
