'use strict';

const Evented = require('../../util/evented');

/**
 * The base class for map-related interface elements.
 *
 * The `Control` class inherits event methods from [`Evented`](#Evented).
 */
class Control extends Evented {
    /**
     * Adds the control to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the control to.
     * @returns {Control} `this`
     */
    addTo(map) {
        this._map = map;
        const container = this._container = this.onAdd(map);
        if (this._position) {
            const corner = map._controlCorners[this._position];
            container.className += ' mapboxgl-ctrl';
            if (this._position.indexOf('bottom') !== -1) {
                corner.insertBefore(container, corner.firstChild);
            } else {
                corner.appendChild(container);
            }
        }

        return this;
    }

    /**
     * Removes the control from the map it has been added to.
     *
     * @returns {Control} `this`
     */
    remove() {
        this._container.parentNode.removeChild(this._container);
        if (this.onRemove) this.onRemove(this._map);
        this._map = null;
        return this;
    }
}

module.exports = Control;
