// @flow

import type {MouseRotateHandler, MousePitchHandler} from '../mouse';

export default class DragRotateHandler {

    _mouseRotate: MouseRotateHandler;
    _mousePitch: MousePitchHandler;
    _pitchWithRotate: boolean;

    constructor(options: {pitchWithRotate: boolean}, mouseRotate: MouseRotateHandler, mousePitch: MousePitchHandler) {
        this._pitchWithRotate = options.pitchWithRotate;
        this._mouseRotate = mouseRotate;
        this._mousePitch = mousePitch;
    }

    enable() {
        this._mouseRotate.enable();
        if (this._pitchWithRotate) this._mousePitch.enable();
    }

    disable() {
        this._mouseRotate.disable();
        this._mousePitch.disable();
    }

    isEnabled() {
        return this._mouseRotate.isEnabled() && (!this._pitchWithRotate || this._mousePitch.isEnabled());
    }

    isActive() {
        return this._mouseRotate.isEnabled() || this._mousePitch.isEnabled();
    }
}
