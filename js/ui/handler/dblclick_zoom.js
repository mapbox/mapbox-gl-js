'use strict';

module.exports = DoubleClickZoomHandler;

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking.
 *
 * @class DoubleClickZoomHandler
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
function DoubleClickZoomHandler(map) {
    this._map = map;
    this._onDblClick = this._onDblClick.bind(this);
}

DoubleClickZoomHandler.prototype = {

    _enabled: false,

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is enabled.
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Enables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._map.on('dblclick', this._onDblClick);
        this._enabled = true;
    },

    /**
     * Disables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.disable();
     */
    disable: function () {
        if (!this.isEnabled()) return;
        this._map.off('dblclick', this._onDblClick);
        this._enabled = false;
    },

    _onDblClick: function (e) {
        this._map.zoomTo(
            this._map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1),
            {around: e.lngLat},
            e
        );
    }
};
