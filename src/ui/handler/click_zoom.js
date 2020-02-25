// @flow

import Handler from './handler';
import type Map from '../map';
import DOM from '../../util/dom';

export default class ClickZoomHandler extends Handler {

    constructor(map: Map, manager, options: ?Object) {
        this.manager = manager;
        super(map, options);
        this.reset();
    }

    reset() {
        this.active = false;
    }

    dblclick(e, point) {
        e.preventDefault();
        setTimeout(() => this.reset(), 300);
        return {
            transform: {
                duration: 300, // TODO
                zoomDelta: e.shiftKey ? -1 : 1,
                around: point
            }
        }
    }
}
