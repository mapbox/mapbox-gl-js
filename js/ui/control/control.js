'use strict';

var util = require('../../util/util');
var Evented = require('../../util/evented');
module.exports = Control;

/**
 * The base class for map-related interface elements.
 *
 * The `Control` class mixes in [`Evented`](#Evented) methods.
 *
 * @class Control
 */
function Control() {}

Control.prototype = {
    /**
     * Adds the control to a map.
     *
     * @param {Map} map The Mapbox GL JS map to add the control to.
     * @returns {Control} `this`
     */
    addTo: function(map) {
        this._map = map;
        var container = this._container = this.onAdd(map);
        if (this.options && this.options.position) {
            var pos = this.options.position;
            var corner = map._controlCorners[pos];
            container.className += ' mapboxgl-ctrl';
            if (pos.indexOf('bottom') !== -1) {
                corner.insertBefore(container, corner.firstChild);
            } else {
                corner.appendChild(container);
            }
        }

        return this;
    },

    /**
     * Removes the control from the map it has been added to.
     *
     * @returns {Control} `this`
     */
    remove: function() {
        this._container.parentNode.removeChild(this._container);
        if (this.onRemove) this.onRemove(this._map);
        this._map = null;
        return this;
    }
};

util.extend(Control.prototype, Evented);
