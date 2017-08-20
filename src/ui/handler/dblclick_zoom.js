// @flow

const util = require('../../util/util');

import type Map from '../map';

/**
 * The `DoubleClickZoomHandler` allows the user to zoom the map at a point by
 * double clicking.
 *
 * @param {Map} map The Mapbox GL JS map to add the handler to.
 */
class DoubleClickZoomHandler {
    _map: Map;
    _enabled: boolean;

    constructor(map: Map) {
        this._map = map;

        util.bindAll([
            '_onDblClick',
        ], this);
    }

    /**
     * Returns a Boolean indicating whether the "double click to zoom" interaction is enabled.
     *
     * @returns {boolean} `true` if the "double click to zoom" interaction is enabled.
     */
    isEnabled() {
        return !!this._enabled;
    }

    /**
     * Enables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.enable();
     */
    enable() {
        if (this.isEnabled()) return;
        this._map.on('dblclick', this._onDblClick);
        this._enabled = true;
    }

    /**
     * Disables the "double click to zoom" interaction.
     *
     * @example
     * map.doubleClickZoom.disable();
     */
    disable() {
        if (!this.isEnabled()) return;
        this._map.off('dblclick', this._onDblClick);
        this._enabled = false;
    }

    _onDblClick(e: any) {
        this._map.zoomTo(
            this._map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1),
            {around: e.lngLat},
            e
        );
    }
}

module.exports = DoubleClickZoomHandler;
