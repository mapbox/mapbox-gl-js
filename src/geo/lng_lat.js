'use strict';

const wrap = require('../util/util').wrap;

/**
 * A `LngLat` object represents a given longitude and latitude coordinate, measured in degrees.
 *
 * Mapbox GL uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match GeoJSON.
 *
 * Note that any Mapbox GL method that accepts a `LngLat` object as an argument or option
 * can also accept an `Array` of two numbers and will perform an implicit conversion.
 * This flexible type is documented as [`LngLatLike`](#LngLatLike).
 *
 * @param {number} lng Longitude, measured in degrees.
 * @param {number} lat Latitude, measured in degrees.
 * @example
 * var ll = new mapboxgl.LngLat(-73.9749, 40.7736);
 * @see [Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
 * @see [Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
 * @see [Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
 */
class LngLat {
    constructor(lng, lat) {
        if (isNaN(lng) || isNaN(lat)) {
            throw new Error(`Invalid LngLat object: (${lng}, ${lat})`);
        }
        this.lng = +lng;
        this.lat = +lat;
        if (this.lat > 90 || this.lat < -90) {
            throw new Error('Invalid LngLat latitude value: must be between -90 and 90');
        }
    }

    /**
     * Returns a new `LngLat` object whose longitude is wrapped to the range (-180, 180).
     *
     * @returns {LngLat} The wrapped `LngLat` object.
     * @example
     * var ll = new mapboxgl.LngLat(286.0251, 40.7736);
     * var wrapped = ll.wrap();
     * wrapped.lng; // = -73.9749
     */
    wrap() {
        return new LngLat(wrap(this.lng, -180, 180), this.lat);
    }

    /**
     * Returns a new `LngLat` object wrapped to the best world to draw it provided a map `center` `LngLat`.
     *
     * When the map is close to the anti-meridian showing a point on world -1 or 1 is a better
     * choice. The heuristic used is to minimize the distance from the map center to the point.
     *
     * Only works where the `LngLat` is wrapped with `LngLat.wrap()` and `center` is within the main world map.
     *
     * @param {LngLat} center Map center within the main world.
     * @return {LngLat} The `LngLat` object in the best world to draw it for the provided map `center`.
     * @example
     * var ll = new mapboxgl.LngLat(170, 0);
     * var mapCenter = new mapboxgl.LngLat(-170, 0);
     * var snapped = ll.wrapToBestWorld(mapCenter);
     * snapped; // = { lng: -190, lat: 0 }
     */
    wrapToBestWorld(center) {
        const wrapped = new LngLat(this.lng, this.lat);

        if (Math.abs(this.lng - center.lng) > 180) {
            if (center.lng < 0) {
                wrapped.lng -= 360;
            } else {
                wrapped.lng += 360;
            }
        }

        return wrapped;
    }

    /**
     * Returns the coordinates represented as an array of two numbers.
     *
     * @returns {Array<number>} The coordinates represeted as an array of longitude and latitude.
     * @example
     * var ll = new mapboxgl.LngLat(-73.9749, 40.7736);
     * ll.toArray(); // = [-73.9749, 40.7736]
     */
    toArray() {
        return [this.lng, this.lat];
    }

    /**
     * Returns the coordinates represent as a string.
     *
     * @returns {string} The coordinates represented as a string of the format `'LngLat(lng, lat)'`.
     * @example
     * var ll = new mapboxgl.LngLat(-73.9749, 40.7736);
     * ll.toString(); // = "LngLat(-73.9749, 40.7736)"
     */
    toString() {
        return `LngLat(${this.lng}, ${this.lat})`;
    }
}

/**
 * Converts an array of two numbers to a `LngLat` object.
 *
 * If a `LngLat` object is passed in, the function returns it unchanged.
 *
 * @param {LngLatLike} input An array of two numbers to convert, or a `LngLat` object to return.
 * @returns {LngLat} A new `LngLat` object, if a conversion occurred, or the original `LngLat` object.
 * @example
 * var arr = [-73.9749, 40.7736];
 * var ll = mapboxgl.LngLat.convert(arr);
 * ll;   // = LngLat {lng: -73.9749, lat: 40.7736}
 */
LngLat.convert = function (input) {
    if (input instanceof LngLat) {
        return input;
    } else if (input && input.hasOwnProperty('lng') && input.hasOwnProperty('lat')) {
        return new LngLat(input.lng, input.lat);
    } else if (Array.isArray(input) && input.length === 2) {
        return new LngLat(input[0], input[1]);
    } else {
        throw new Error("`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]");
    }
};

module.exports = LngLat;
