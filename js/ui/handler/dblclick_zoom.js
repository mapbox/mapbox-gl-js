'use strict';

module.exports = DoubleClickZoomHandler;

/**
 * The `DoubleClickZoomHandler` allows a user to zoom the map around point by
 * double clicking.
 * @class DoubleClickZoomHandler
 * @property {boolean} enabled Whether the "double click to zoom" interaction is currently enabled
 */
function DoubleClickZoomHandler(map) {
    this._map = map;
    this._onDblClick = this._onDblClick.bind(this);
}

DoubleClickZoomHandler.prototype = {

    enabled: false,

    /**
     * Enable the "double click to zoom" interaction.
     * @example
     *   map.doubleClickZoom.enable();
     */
    enable: function () {
        this.disable();
        this._map.on('dblclick', this._onDblClick);
        this.enabled = true;
    },

    /**
     * Disable the "double click to zoom" interaction.
     * @example
     *   map.doubleClickZoom.disable();
     */
    disable: function () {
        this._map.off('dblclick', this._onDblClick);
        this.enabled = false;
    },

    _onDblClick: function (e) {
        this._map.zoomTo(this._map.getZoom() +
            (e.originalEvent.shiftKey ? -1 : 1), {around: e.lngLat});
    }
};
