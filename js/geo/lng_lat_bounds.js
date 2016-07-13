'use strict';

module.exports = LngLatBounds;

var LngLat = require('./lng_lat');

/**
 * A `LngLatBounds` object represents a geographical bounding box,
 * defined by its southwest and northeast points in longitude and latitude.
 *
 * If no arguments are provided to the constructor, a `null` bounding box is created.
 *
 * Note that any Mapbox GL method that accepts a `LngLatBounds` object as an argument or option
 * can also accept an `Array` of two [`LngLatLike`](#LngLatLike) constructs and will perform an implicit conversion.
 * This flexible type is documented as [`LngLatBoundsLike`](#LngLatBoundsLike).
 *
 * @class LngLatBounds
 * @param {LngLatLike} sw The southwest corner of the bounding box.
 * @param {LngLatLike} ne The northeast corner of the bounding box.
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
     * Extends the bounding box to include an area represented by a `LngLat` or `LngLatBounds`.
     *
     * @param {LngLatLike|LngLatBoundsLike} obj The area that the bounding box will extend to include.
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
     * Returns the geographical coordinate equidistant from the bounding box's corners.
     *
     * @returns {LngLat} The bounding box's center.
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
     */
    getCenter: function() {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    },

    /**
     * Returns the southwest corner of the bounding box.
     *
     * @returns {LngLat} The southwest corner of the bounding box.
     */
    getSouthWest: function() { return this._sw; },

    /**
    * Returns the northeast corner of the bounding box.
    *
    * @returns {LngLat} The northeast corner of the bounding box.
     */
    getNorthEast: function() { return this._ne; },

    /**
    * Returns the northwest corner of the bounding box.
    *
    * @returns {LngLat} The northwest corner of the bounding box.
     */
    getNorthWest: function() { return new LngLat(this.getWest(), this.getNorth()); },

    /**
    * Returns the southeast corner of the bounding box.
    *
    * @returns {LngLat} The southeast corner of the bounding box.
     */
    getSouthEast: function() { return new LngLat(this.getEast(), this.getSouth()); },

    /**
    * Returns the west edge of the bounding box.
    *
    * @returns {LngLat} The west edge of the bounding box.
     */
    getWest:  function() { return this._sw.lng; },

    /**
    * Returns the south edge of the bounding box.
    *
    * @returns {LngLat} The south edge of the bounding box.
     */
    getSouth: function() { return this._sw.lat; },

    /**
    * Returns the east edge of the bounding box.
    *
    * @returns {LngLat} The east edge of the bounding box.
     */
    getEast:  function() { return this._ne.lng; },

    /**
    * Returns the north edge of the bounding box.
    *
    * @returns {LngLat} The north edge of the bounding box.
     */
    getNorth: function() { return this._ne.lat; },

    /**
     * Returns the bounding box represented as an array.
     *
     * @returns {Array<Array<number>>} The bounding box represented as an array, consisting of the
     *   southwest and northeast coordinates of the bounding represented as arrays of numbers.
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
     */
    toArray: function () {
        return [this._sw.toArray(), this._ne.toArray()];
    },

    /**
     * Return the bounding box represented as a string.
     *
     * @returns {string} The bounding box represents as a string of the format
     *   `'LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))'`.
     * @example
     * var llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
     */
    toString: function () {
        return 'LngLatBounds(' + this._sw.toString() + ', ' + this._ne.toString() + ')';
    }
};

/**
 * Converts an array to a `LngLatBounds` object.
 *
 * If a `LngLatBounds` object is passed in, the function returns it unchanged.
 *
 * Internally, the function calls `LngLat#convert` to convert arrays to `LngLat` values.
 *
 * @param {LngLatBoundsLike} input An array of two coordinates to convert, or a `LngLatBounds` object to return.
 * @returns {LngLatBounds} A new `LngLatBounds` object, if a conversion occurred, or the original `LngLatBounds` object.
 * @example
 * var arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 * var llb = mapboxgl.LngLatBounds.convert(arr);
 * llb;   // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
 */
LngLatBounds.convert = function (input) {
    if (!input || input instanceof LngLatBounds) return input;
    return new LngLatBounds(input);
};
