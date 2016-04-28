'use strict';

module.exports = KeyboardHandler;


var panDelta = 80,
    rotateDelta = 2,
    pitchDelta = 5;

/**
 * The `KeyboardHandler` allows a user to zoom, rotate, and pan the map using
 * following keyboard shortcuts:
 *  * `=` / `+`: increase zoom level by 1
 *  * `Shift-=` / `Shift-+`: increase zoom level by 2
 *  * `-`: decrease zoom level by 1
 *  * `Shift--`: decrease zoom level by 2
 *  * Arrow keys: pan by 80 pixels
 *  * `Shift+⇢`: increase rotation by 2 degrees
 *  * `Shift+⇠`: decrease rotation by 2 degrees
 *  * `Shift+⇡`: increase pitch by 5 degrees
 *  * `Shift+⇣`: decrease pitch by 5 degrees
 * @class KeyboardHandler
 */
function KeyboardHandler(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    this._onKeyDown = this._onKeyDown.bind(this);
}

KeyboardHandler.prototype = {

    _enabled: false,

    /**
     * Returns the current enabled/disabled state of keyboard interaction.
     * @returns {boolean} enabled state
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Enable the ability to interact with the map using keyboard input.
     * @example
     * map.keyboard.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._el.addEventListener('keydown', this._onKeyDown, false);
        this._enabled = true;
    },

    /**
     * Disable the ability to interact with the map using keyboard input.
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

        var map = this._map,
            eventData = { originalEvent: e };

        switch (e.keyCode) {
        case 61:
        case 107:
        case 171:
        case 187:
            map.zoomTo(Math.round(map.getZoom()) + (e.shiftKey ? 2 : 1), eventData);
            break;

        case 189:
        case 109:
        case 173:
            map.zoomTo(Math.round(map.getZoom()) - (e.shiftKey ? 2 : 1), eventData);
            break;

        case 37:
            if (e.shiftKey) {
                map.easeTo({ bearing: map.getBearing() - rotateDelta }, eventData);
            } else {
                e.preventDefault();
                map.panBy([-panDelta, 0], eventData);
            }
            break;

        case 39:
            if (e.shiftKey) {
                map.easeTo({ bearing: map.getBearing() + rotateDelta }, eventData);
            } else {
                e.preventDefault();
                map.panBy([panDelta, 0], eventData);
            }
            break;

        case 38:
            if (e.shiftKey) {
                map.easeTo({ pitch: map.getPitch() + pitchDelta }, eventData);
            } else {
                e.preventDefault();
                map.panBy([0, -panDelta], eventData);
            }
            break;

        case 40:
            if (e.shiftKey) {
                map.easeTo({ pitch: Math.max(map.getPitch() - pitchDelta, 0) }, eventData);
            } else {
                e.preventDefault();
                map.panBy([0, panDelta], eventData);
            }
            break;
        }
    }
};
