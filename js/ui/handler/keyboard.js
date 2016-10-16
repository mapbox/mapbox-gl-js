'use strict';

module.exports = KeyboardHandler;


var panStep = 100,
    bearingStep = 15,
    pitchStep = 10;

/**
 * The `KeyboardHandler` allows the user to zoom, rotate, and pan the map using
 * the following keyboard shortcuts:
 *
 * - `=` / `+`: Increase the zoom level by 1.
 * - `Shift-=` / `Shift-+`: Increase the zoom level by 2.
 * - `-`: Decrease the zoom level by 1.
 * - `Shift--`: Decrease the zoom level by 2.
 * - Arrow keys: Pan by 100 pixels.
 * - `Shift+⇢`: Increase the rotation by 15 degrees.
 * - `Shift+⇠`: Decrease the rotation by 15 degrees.
 * - `Shift+⇡`: Increase the pitch by 10 degrees.
 * - `Shift+⇣`: Decrease the pitch by 10 degrees.
 *
 * @class KeyboardHandler
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
function KeyboardHandler(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    this._onKeyDown = this._onKeyDown.bind(this);
}

function easeOut(t) {
    return t * (2 - t);
}

KeyboardHandler.prototype = {

    _enabled: false,

    /**
     * Returns a Boolean indicating whether keyboard interaction is enabled.
     *
     * @returns {boolean} `true` if keyboard interaction is enabled.
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Enables keyboard interaction.
     *
     * @example
     * map.keyboard.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._el.addEventListener('keydown', this._onKeyDown, false);
        this._enabled = true;
    },

    /**
     * Disables keyboard interaction.
     *
     * @example
     * map.keyboard.disable();
     */
    disable: function () {
        if (!this.isEnabled()) return;
        this._el.removeEventListener('keydown', this._onKeyDown);
        this._enabled = false;
    },

    _onKeyDown: function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        var zoomDir = 0;
        var bearingDir = 0;
        var pitchDir = 0;
        var xDir = 0;
        var yDir = 0;

        switch (e.keyCode) {
        case 61:
        case 107:
        case 171:
        case 187:
            zoomDir = 1;
            break;

        case 189:
        case 109:
        case 173:
            zoomDir = -1;
            break;

        case 37:
            if (e.shiftKey) {
                bearingDir = -1;
            } else {
                e.preventDefault();
                xDir = -1;
            }
            break;

        case 39:
            if (e.shiftKey) {
                bearingDir = 1;
            } else {
                e.preventDefault();
                xDir = 1;
            }
            break;

        case 38:
            if (e.shiftKey) {
                pitchDir = 1;
            } else {
                e.preventDefault();
                yDir = -1;
            }
            break;

        case 40:
            if (e.shiftKey) {
                pitchDir = -1;
            } else {
                yDir = 1;
                e.preventDefault();
            }
            break;
        }

        var map = this._map;
        var zoom = map.getZoom();

        var easeOptions = {
            duration: 300,
            delayEndEvents: 500,
            easing: easeOut,

            zoom: zoomDir ? Math.round(zoom) + zoomDir * (e.shiftKey ? 2 : 1) : zoom,
            bearing: map.getBearing() + bearingDir * bearingStep,
            pitch: map.getPitch() + pitchDir * pitchStep,
            offset: [-xDir * panStep, -yDir * panStep],
            center: map.getCenter()
        };

        map.easeTo(easeOptions, {originalEvent: e});
    }
};
