// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

export default class MousePitchHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        this.manager = manager;
        super(map, options);
    }

    mousedown(e, point) {
        const eventButton = DOM.mouseButton(e);
        if (eventButton !== LEFT_BUTTON && eventButton !== RIGHT_BUTTON) return;
        if (eventButton === LEFT_BUTTON && !e.ctrlKey) return;

        this._lastPoint = point;
        this._eventButton = eventButton;
    }

    mousemove(e, point) {
        if (!this._lastPoint) return;

        const pitchDelta = (this._lastPoint.y - point.y) * 0.5;
        this._lastPoint = point;

        return {
            transform: {
                pitchDelta
            }
        };
    }

    mouseup(e, point) {
        const eventButton = DOM.mouseButton(e);
        if (this._eventButton !== eventButton) return;
        this._lastPoint = null;
    }
}
