// @flow

import type ClickZoomHandler from '../click_zoom.js';
import type TapZoomHandler from './../tap_zoom.js';

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking or double tapping.
 *
 * @see [Example: Toggle interactions](https://docs.mapbox.com/mapbox-gl-js/example/toggle-interaction-handlers/)
 */
export default class DoubleClickZoomHandler {

    _clickZoom: ClickZoomHandler;
    _tapZoom: TapZoomHandler;

    /**
     * @private
    */
    constructor(clickZoom: ClickZoomHandler, TapZoom: TapZoomHandler) {
        this._clickZoom = clickZoom;
        this._tapZoom = TapZoom;
    }

    /**
     * Enables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.enable();
     */
    enable() {
        this._clickZoom.enable();
        this._tapZoom.enable();
    }

    /**
     * Disables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.disable();
     */
    disable() {
        this._clickZoom.disable();
        this._tapZoom.disable();
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.
     *
     * @returns {boolean} Returns `true` if the "double click to zoom" interaction is enabled.
     * @example
     * const isDoubleClickZoomEnabled = map.doubleClickZoom.isEnabled();
     */
    isEnabled() {
        return this._clickZoom.isEnabled() && this._tapZoom.isEnabled();
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is active (currently being used).
     *
     * @returns {boolean} Returns `true` if the "double click to zoom" interaction is active.
     * @example
     * const isDoubleClickZoomActive = map.doubleClickZoom.isActive();
     */
    isActive() {
        return this._clickZoom.isActive() || this._tapZoom.isActive();
    }
}
