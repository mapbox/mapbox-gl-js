// @flow

import type TouchZoomHandler from './touch_zoom';
import type TouchRotateHandler from './touch_rotate';

export default class TouchZoomRotateHandler {

    _touchZoom: TouchZoomHandler;
    _touchRotate: TouchRotateHandler;
    _rotationDisabled: boolean;
    _enabled: boolean;

    /**
     * @private
    */
    constructor(touchZoom: TouchZoomHandler, touchRotate: TouchRotateHandler) {
        this._touchZoom = touchZoom;
        this._touchRotate = touchRotate;
        this._rotationDisabled = false;
        this._enabled = true;
    }

    /**
     * Enables the "pinch to rotate and zoom" interaction.
     *
     * @param {Object} [options]
     * @param {string} [options.around] If "center" is passed, map will zoom around the center
     *
     * @example
     *   map.touchZoomRotate.enable();
     * @example
     *   map.touchZoomRotate.enable({ around: 'center' });
     */
    enable(options: ?{around?: 'center'}) {
        this._touchZoom.enable(options);
        if (!this._rotationDisabled) this._touchRotate.enable(options);
    }

    /**
     * Disables the "pinch to rotate and zoom" interaction.
     *
     * @example
     *   map.touchZoomRotate.disable();
     */
    disable() {
        this._touchZoom.disable();
        this._touchRotate.disable();
    }

    /**
     * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "pinch to rotate and zoom" interaction is enabled.
     */
    isEnabled() {
        return this._touchZoom.isEnabled() && (this._rotationDisabled || this._touchRotate.isEnabled());
    }

    /**
     * Returns true if the handler is enabled and has detected the start of a zoom/rotate gesture.
     *
     * @returns {boolean}
     */
    isActive() {
        return this._touchZoom.isActive() || this._touchRotate.isActive();
    }

    /**
     * Disables the "pinch to rotate" interaction, leaving the "pinch to zoom"
     * interaction enabled.
     *
     * @example
     *   map.touchZoomRotate.disableRotation();
     */
    disableRotation() {
        this._rotationDisabled = true;
        this._touchRotate.disable();
    }

    /**
     * Enables the "pinch to rotate" interaction.
     *
     * @example
     *   map.touchZoomRotate.enable();
     *   map.touchZoomRotate.enableRotation();
     */
    enableRotation() {
        this._rotationDisabled = false;
        if (this._touchZoom.isEnabled()) this._touchRotate.enable();
    }
}
