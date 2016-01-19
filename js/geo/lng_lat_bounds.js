'use strict';

module.exports = LngLatBounds;

var LngLat = require('./lng_lat');

/**
 * Creates a bounding box from the given pair of points. If parameteres are omitted, a `null` bounding box is created.
 *
 * @class LngLatBounds
 * @classdesc A representation of rectangular box on the earth, defined by its southwest and northeast points in longitude and latitude.
 * @param {LngLat} sw southwest
 * @param {LngLat} ne northeast
 * @example
 * var sw = new mapboxgl.LngLat(-73.9876, 40.7661);
 * var ne = new mapboxgl.LngLat(-73.9397, 40.8002);
 * var llb = new mapboxgl.LngLatBounds(sw, ne);
 */
function LngLatBounds(sw, ne) {
    if (!sw) {
        return;
    } else if (ne) {
        this.extend(sw).extend(ne);
    } else if (sw.length === 4) {
        this.extend([sw[0], sw[1]]).extend([sw[2], sw[3]]);
    } else {
        this.extend(sw[0]).extend(sw[1]);
    }
}

LngLatBounds.prototype = {

    /**
     * Extend the bounds to include a given LngLat or LngLatBounds.
     *
     * @param {LngLat|LngLatBounds} obj object to extend to
     * @returns {LngLatBounds} `this`
     */
    extend: function(obj) {
        var sw = this._sw,
            ne = this._ne,
            sw2, ne2;

        if (obj instanceof LngLat) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LngLatBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else {
            return obj ? this.extend(LngLat.convert(obj) || LngLatBounds.convert(obj)) : this;
        }

        if (!sw && !ne) {
            this._sw = new LngLat(sw2.lng, sw2.lat);
            this._ne = new LngLat(ne2.lng, ne2.lat);

        } else {
            sw.lng = Math.min(sw2.lng, sw.lng);
            sw.lat = Math.min(sw2.lat, sw.lat);
            ne.lng = Math.max(ne2.lng, ne.lng);
            ne.lat = Math.max(ne2.lat, ne.lat);
        }

        return this;
    },

    /**
     * Get the point equidistant from this box's corners
     * @returns {LngLat} centerpoint
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
     */
    getCenter: function() {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    },

    /**
     * Get southwest corner
     * @returns {LngLat} southwest
     */
    getSouthWest: function() { return this._sw; },

    /**
     * Get northeast corner
     * @returns {LngLat} northeast
     */
    getNorthEast: function() { return this._ne; },

    /**
     * Get northwest corner
     * @returns {LngLat} northwest
     */
    getNorthWest: function() { return new LngLat(this.getWest(), this.getNorth()); },

    /**
     * Get southeast corner
     * @returns {LngLat} southeast
     */
    getSouthEast: function() { return new LngLat(this.getEast(), this.getSouth()); },

    /**
     * Get west edge longitude
     * @returns {number} west
     */
    getWest:  function() { return this._sw.lng; },

    /**
     * Get south edge latitude
     * @returns {number} south
     */
    getSouth: function() { return this._sw.lat; },

    /**
     * Get east edge longitude
     * @returns {number} east
     */
    getEast:  function() { return this._ne.lng; },

    /**
     * Get north edge latitude
     * @returns {number} north
     */
    getNorth: function() { return this._ne.lat; },

    /**
     * Return a `LngLatBounds` as an array
     *
     * @returns {array} [lng, lat]
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
     */
    toArray: function () {
        return [this._sw.toArray(), this._ne.toArray()];
    },

    /**
     * Return a `LngLatBounds` as a string
     *
     * @returns {string} "LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))"
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
     */
    toString: function () {
        return 'LngLatBounds(' + this._sw.toString() + ', ' + this._ne.toString() + ')';
    }
};

/**
 * Convert an array to a `LngLatBounds` object, or return an existing
 * `LngLatBounds` object unchanged.
 *
 * Calls `LngLat#convert` internally to convert arrays as `LngLat` values.
 *
 * @param {LngLatBounds|Array<number>|Array<Array<number>>} input input to convert to a LngLatBounds
 * @returns {LngLatBounds} LngLatBounds object or original input
 * @example
 * var arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 * var llb = mapboxgl.LngLatBounds.convert(arr);
 * llb;   // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
 */
LngLatBounds.convert = function (input) {
    if (!input || input instanceof LngLatBounds) return input;
    return new LngLatBounds(input);
};
