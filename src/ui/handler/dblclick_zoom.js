// @flow

import type Point from '@mapbox/point-geometry';

export default class ClickZoomHandler {

    _enabled: boolean;
    _active: boolean;

    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
    }

    dblclick(e: MouseEvent, point: Point) {
        e.preventDefault();
        return {
            transform: {
                duration: 300, // TODO
                zoomDelta: e.shiftKey ? -1 : 1,
                around: point
            }
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
