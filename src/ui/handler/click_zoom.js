// @flow

export default class ClickZoomHandler {

    constructor() {
        this.reset();
    }

    reset() {
        this._active = false;
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
