'use strict';

module.exports = DoubleClickZoomHandler;

/**
 * The `DoubleClickZoomHandler` allows a user to zoom the map around point by
 * double clicking.
 * @class DoubleClickZoomHandler
 */
function DoubleClickZoomHandler(map) {
    this._map = map;
    this._onDblClick = this._onDblClick.bind(this);
}

DoubleClickZoomHandler.prototype = {

    _enabled: false,

    /**
     * Returns the current enabled/disabled state of the "double click to zoom" interaction.
     * @returns {boolean} enabled state
     */
    isEnabled: function () {
        return this._enabled;
    },

    /**
     * Enable the "double click to zoom" interaction.
     * @example
     * map.doubleClickZoom.enable();
     */
    enable: function () {
        if (this.isEnabled()) return;
        this._map.on('dblclick', this._onDblClick);
        this._enabled = true;
    },

    /**
     * Disable the "double click to zoom" interaction.
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
