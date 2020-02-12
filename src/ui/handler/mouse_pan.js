// @flow

import Handler from './handler';
import type Map from '../map';


export default class MousePanHandler extends Handler {

    constructor(map: Map, options: ?Object) {
        super(map, options);
    }

    mousedown(e, point) {
        this._lastPoint = point;
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
        this._lastPoint = null;
    }
}
