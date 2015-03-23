'use strict';

module.exports = LatLng;

var wrap = require('../util/util').wrap;

/**
 * Create a latitude, longitude object from a given latitude and longitude pair in degrees.
 *
 * @class LatLng
 * @classdesc A representation of a latitude and longitude point, in degrees.
 * @param {number} lat latitude
 * @param {number} lng longitude
 * @example
 * var latlng = new mapboxgl.LatLng(37.76, -122.44);
 *
 */
function LatLng(lat, lng) {
    if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
    }
    this.lat = +lat;
    this.lng = +lng;
}

/**
 * Return a new `LatLng` object whose longitude is wrapped to the range (-180, 180).
 *
 * @returns {LatLng} wrapped LatLng object
 */
LatLng.prototype.wrap = function () {
    return new LatLng(this.lat, wrap(this.lng, -180, 180));
};

/**
 * Convert an array to a `LatLng` object, or return an existing `LatLng` object
 * unchanged.
 *
 * @param {Array<number>|LatLng} input `input` to convert
 * @returns {LatLng} LatLng object or original input
 */
LatLng.convert = function (input) {
    if (input instanceof LatLng) {
        return input;
    }
    if (Array.isArray(input)) {
        return new LatLng(input[0], input[1]);
    }
    return input;
};
