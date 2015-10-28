'use strict';

module.exports = Keyboard;


var panDelta = 80,
    rotateDelta = 2,
    pitchDelta = 5;

/**
 * The `Keyboard` handler responds to keyboard input by zooming, rotating, or panning the
 * map. The following keyboard shortcuts are supported:
 *  * `=` / `+`: increase zoom level by 1
 *  * `Shift-=` / `Shift-+`: increase zoom level by 2
 *  * `-`: decrease zoom level by 1
 *  * `Shift--`: decrease zoom level by 2
 *  * Arrow keys: pan by 80 pixels
 *  * `Shift+⇢`: increase rotation by 2 degrees
 *  * `Shift+⇠`: decrease rotation by 2 degrees
 *  * `Shift+⇡`: increase pitch by 5 degrees
 *  * `Shift+⇣`: decrease pitch by 5 degrees
 * @class Keyboard
 * @example
 *   // Disable the keyboard handler
 *   map.keyboard.disable();
 * @example
 *   // Enable the keyboard handler
 *   map.keyboard.enable();
 */
function Keyboard(map) {
    this._map = map;
    this._el = map.getCanvasContainer();

    this._onKeyDown = this._onKeyDown.bind(this);
}

Keyboard.prototype = {
    enable: function () {
        this._el.addEventListener('keydown', this._onKeyDown, false);
    },

    disable: function () {
        this._el.removeEventListener('keydown', this._onKeyDown);
    },

    _onKeyDown: function (e) {
        if (e.altKey || e.ctrlKey || e.metaKey) return;

        var map = this._map;

        switch (e.keyCode) {
        case 61:
        case 107:
        case 171:
        case 187:
            map.zoomTo(Math.round(map.getZoom()) + (e.shiftKey ? 2 : 1));
            break;

        case 189:
        case 109:
        case 173:
            map.zoomTo(Math.round(map.getZoom()) - (e.shiftKey ? 2 : 1));
            break;

        case 37:
            if (e.shiftKey) {
                map.setBearing(map.getBearing() - rotateDelta);
            } else {
                map.panBy([-panDelta, 0]);
            }
            break;

        case 39:
            if (e.shiftKey) {
                map.setBearing(map.getBearing() + rotateDelta);
            } else {
                map.panBy([panDelta, 0]);
            }
            break;

        case 38:
            if (e.shiftKey) {
                map.setPitch(map.getPitch() + pitchDelta);
            } else {
                map.panBy([0, -panDelta]);
            }
            break;

        case 40:
            if (e.shiftKey) {
                map.setPitch(Math.max(map.getPitch() - pitchDelta, 0));
            } else {
                map.panBy([0, panDelta]);
            }
            break;
        }
    }
};
