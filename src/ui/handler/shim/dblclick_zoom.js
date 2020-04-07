// @flow

import type ClickZoomHandler from '../click_zoom';
import type TapZoomHandler from './../tap_zoom';

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking or double tapping.
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
     * @returns {boolean} `true` if the "double click to zoom" interaction is enabled.
     */
    isEnabled() {
        return this._clickZoom.isEnabled() && this._tapZoom.isEnabled();
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is active, i.e. currently being used.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is active.
     */
    isActive() {
        return this._clickZoom.isActive() || this._tapZoom.isActive();
    }
}
