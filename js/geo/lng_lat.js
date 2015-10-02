'use strict';

module.exports = LngLat;

var wrap = require('../util/util').wrap;

/**
 * Create a longitude, latitude object from a given longitude and latitude pair in degrees.
 * Mapbox GL uses Longitude, Latitude coordinate order to match GeoJSON.
 *
 * Note that any Mapbox GL method that accepts a `LngLat` object can also accept an
 * `Array` and will perform an implicit conversion.  The following lines are equivalent:
 ```
 map.setCenter([-79.469, 39.261]);
 map.setCenter( new mapboxgl.LngLat(-79.469, 39.261) );
 ```
 *
 * @class LngLat
 * @classdesc A representation of a longitude, latitude point, in degrees.
 * @param {number} lng longitude
 * @param {number} lat latitude
 * @example
 * var lnglat = new mapboxgl.LngLat(37.76, -122.44);
 */
function LngLat(lng, lat) {
    if (isNaN(lng) || isNaN(lat)) {
        throw new Error('Invalid LngLat object: (' + lng + ', ' + lat + ')');
    }
    this.lng = +lng;
    this.lat = +lat;
    if (this.lat > 90 || this.lat < -90) {
        throw new Error('Invalid LngLat latitude value: must be between -90 and 90');
    }
}

/**
 * Return a new `LngLat` object whose longitude is wrapped to the range (-180, 180).
 *
 * @returns {LngLat} wrapped LngLat object
 * @example
 * var point = mapboxgl.LngLat(0, 200);
 * var wrapped = point.wrap();
 * wrapped.lng; // = -160
 */
LngLat.prototype.wrap = function () {
    return new LngLat(wrap(this.lng, -180, 180), this.lat);
};

/**
 * Return a `LngLat` as an array
 *
 * @returns {array} [lng, lat]
 * @example
 * var ll = new mapboxgl.LngLat(-73.9749, 40.7736);
 * ll.toArray(); // = [-73.9749, 40.7736]
 */
LngLat.prototype.toArray = function () {
    return [this.lng, this.lat];
};

/**
 * Return a `LngLat` as a string
 *
 * @returns {string} "LngLat(lng, lat)"
 * @example
 * var ll = new mapboxgl.LngLat(-73.9749, 40.7736);
 * ll.toString(); // = "LngLat(-73.9749, 40.7736)"
 */
LngLat.prototype.toString = function () {
    return 'LngLat(' + this.lng + ', ' + this.lat + ')';
};

/**
 * Convert an array to a `LngLat` object, or return an existing `LngLat` object
 * unchanged.
 *
 * @param {Array<number>|LngLat} input `input` to convert
 * @returns {LngLat} LngLat object or original input
 * @example
 * var ll = mapboxgl.LngLat.convert([10, 10]);
 * var ll2 = new mapboxgl.LngLat(10, 10);
 * ll // = ll2
 */
LngLat.convert = function (input) {
    if (input instanceof LngLat) {
        return input;
    }
    if (Array.isArray(input)) {
        return new LngLat(input[0], input[1]);
    }
    return input;
};
