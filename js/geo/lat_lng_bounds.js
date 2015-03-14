'use strict';

module.exports = LatLngBounds;

var LatLng = require('./lat_lng');

/**
 * Creates a bounding box from the given pair of points. If parameteres are omitted, a `null` bounding box is created.
 *
 * @class mapboxgl.LatLngBounds
 * @classdesc A representation of rectangular box on the earth, defined by its southwest and northeast points in latitude and longitude.
 * @param {Object} southwest `LatLng` object
 * @param {Object} northeast `LatLng` object
 * @returns {mapboxgl.LatLngBounds} `this`
 * @example
 * var sw = new mapboxgl.LatLng(0, 0);
 * var ne = new mapboxgl.LatLng(10, -10);
 * var bounds = new mapboxgl.LatLngBounds(sw, ne);
 *
 */
function LatLngBounds(sw, ne) {
    if (!sw) return;

    var latlngs = ne ? [sw, ne] : sw;

    for (var i = 0, len = latlngs.length; i < len; i++) {
        this.extend(latlngs[i]);
    }
}

LatLngBounds.prototype = {

    /**
    * Extend Enlarge the bounds to include a given point
    *
    * @param {Object} LatLng New `LatLng` object containing coordinates to extend to
    * @returns {mapboxgl.LatLngBounds} `this`
    */
    extend: function(obj) {
        var sw = this._sw,
            ne = this._ne,
            sw2, ne2;

        if (obj instanceof LatLng) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LatLngBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else {
            return obj ? this.extend(LatLng.convert(obj) || LatLngBounds.convert(obj)) : this;
        }

        if (!sw && !ne) {
            this._sw = new LatLng(sw2.lat, sw2.lng);
            this._ne = new LatLng(ne2.lat, ne2.lng);

        } else {
            sw.lat = Math.min(sw2.lat, sw.lat);
            sw.lng = Math.min(sw2.lng, sw.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
        }

        return this;
    },

    /**
     * Get the point equidistant from this box's corners
     * @returns {Object} `LatLng` object
     */
    getCenter: function() {
        return new LatLng((this._sw.lat + this._ne.lat) / 2, (this._sw.lng + this._ne.lng) / 2);
    },

    /**
     * Get southwest corner
     * @returns {Object} `LatLng` object
     */
    getSouthWest: function() { return this._sw; },

    /**
     * Get northeast corner
     * @returns {Object} `LatLng` object
     */
    getNorthEast: function() { return this._ne; },

    /**
     * Get northwest corner
     * @returns {Object} `LatLng` object
     */
    getNorthWest: function() { return new LatLng(this.getNorth(), this.getWest()); },

    /**
     * Get southeast corner
     * @returns {Object} `LatLng` object
     */
    getSouthEast: function() { return new LatLng(this.getSouth(), this.getEast()); },

    /**
     * Get west edge longitude
     * @returns {Number}
     */
    getWest:  function() { return this._sw.lng; },

    /**
     * Get south edge latitude
     * @returns {Number}
     */
    getSouth: function() { return this._sw.lat; },

    /**
     * getEast Get east edge longitude
     * @returns {Number}
     */
    getEast:  function() { return this._ne.lng; },

    /**
     * getNorth Get north edge latitude
     * @returns {Number}
     */
    getNorth: function() { return this._ne.lat; }
};

// constructs LatLngBounds from an array if necessary
LatLngBounds.convert = function (a) {
    if (!a || a instanceof LatLngBounds) return a;
    return new LatLngBounds(a);
};
