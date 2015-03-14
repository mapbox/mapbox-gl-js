'use strict';

module.exports = LatLng;

var wrap = require('../util/util').wrap;

/**
 * Create a latitude, longitude object from a given latitude and longitude pair in degrees.
 *
 * @class mapboxgl.LatLng
 * @classdesc A representation of a latitude and longitude point, in degrees.
 * @param {Number} latitude
 * @param {Number} longitude
 * @returns {mapboxgl.LatLng} `this`
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

LatLng.prototype.wrap = function () {
    return new LatLng(this.lat, wrap(this.lng, -180, 180));
};

// constructs LatLng from an array if necessary

LatLng.convert = function (a) {
    if (a instanceof LatLng) {
        return a;
    }
    if (Array.isArray(a)) {
        return new LatLng(a[0], a[1]);
    }
    return a;
};
