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
 * @property {boolean} enabled Whether keyboard interaction is currently enabled
 */
function KeyboardHandler(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    this._onKeyDown = this._onKeyDown.bind(this);
}

KeyboardHandler.prototype = {

    enabled: false,

    /**
     * Enable the ability to interact with the map using keyboard input.
     * @example
     *   map.keyboard.enable();
     */
    enable: function () {
        this.disable();
        this._el.addEventListener('keydown', this._onKeyDown, false);
        this.enabled = true;
    },

    /**
     * Disable the ability to interact with the map using keyboard input.
     * @example
     *   map.keyboard.disable();
     */
    disable: function () {
        this._el.removeEventListener('keydown', this._onKeyDown);
        this.enabled = false;
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
                map.panBy([-panDelta, 0], eventData);
            }
            break;

        case 39:
            if (e.shiftKey) {
                map.easeTo({ bearing: map.getBearing() + rotateDelta }, eventData);
            } else {
                map.panBy([panDelta, 0], eventData);
            }
            break;

        case 38:
            if (e.shiftKey) {
                map.easeTo({ pitch: map.getPitch() + pitchDelta }, eventData);
            } else {
                map.panBy([0, -panDelta], eventData);
            }
            break;

        case 40:
            if (e.shiftKey) {
                map.easeTo({ pitch: Math.max(map.getPitch() - pitchDelta, 0) }, eventData);
            } else {
                map.panBy([0, panDelta], eventData);
            }
            break;
        }
    }
};
