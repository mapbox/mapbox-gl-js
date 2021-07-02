// @flow

import type {TouchZoomHandler, TouchRotateHandler} from '../touch_zoom_rotate.js';
import type TapDragZoomHandler from '../tap_drag_zoom.js';

/**
 * The `TouchZoomRotateHandler` allows the user to zoom and rotate the map by
 * pinching on a touchscreen.
 *
 * They can zoom with one finger by double tapping and dragging. On the second tap,
 * hold the finger down and drag up or down to zoom in or out.
 * @see [Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
 */
export default class TouchZoomRotateHandler {

    _el: HTMLElement;
    _touchZoom: TouchZoomHandler;
    _touchRotate: TouchRotateHandler;
    _tapDragZoom: TapDragZoomHandler;
    _rotationDisabled: boolean;
    _enabled: boolean;

    /**
     * @private
    */
    constructor(el: HTMLElement, touchZoom: TouchZoomHandler, touchRotate: TouchRotateHandler, tapDragZoom: TapDragZoomHandler) {
        this._el = el;
        this._touchZoom = touchZoom;
        this._touchRotate = touchRotate;
        this._tapDragZoom = tapDragZoom;
        this._rotationDisabled = false;
        this._enabled = true;
    }

    /**
     * Enables the "pinch to rotate and zoom" interaction.
     *
     * @param {Object} [options] Options object.
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
        this._tapDragZoom.enable();
        this._el.classList.add('mapboxgl-touch-zoom-rotate');
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
        this._tapDragZoom.disable();
        this._el.classList.remove('mapboxgl-touch-zoom-rotate');
    }

    /**
     * Returns a Boolean indicating whether the "pinch to rotate and zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "pinch to rotate and zoom" interaction is enabled.
     */
    isEnabled() {
        return this._touchZoom.isEnabled() &&
            (this._rotationDisabled || this._touchRotate.isEnabled()) &&
            this._tapDragZoom.isEnabled();
    }

    /**
     * Returns true if the handler is enabled and has detected the start of a zoom/rotate gesture.
     *
     * @returns {boolean}
     */
    isActive() {
        return this._touchZoom.isActive() || this._touchRotate.isActive() || this._tapDragZoom.isActive();
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
