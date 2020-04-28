// @flow

import {wrap} from '../util/util';
import LngLatBounds from './lng_lat_bounds';

/*
* Approximate radius of the earth in meters.
* Uses the WGS-84 approximation. The radius at the equator is ~6378137 and at the poles is ~6356752. https://en.wikipedia.org/wiki/World_Geodetic_System#WGS84
* 6371008.8 is one published "average radius" see https://en.wikipedia.org/wiki/Earth_radius#Mean_radius, or ftp://athena.fsv.cvut.cz/ZFG/grs80-Moritz.pdf p.4
*/
export const earthRadius = 6371008.8;

/**
 * A `LngLat` object represents a given longitude and latitude coordinate, measured in degrees.
 * These coordinates are based on the [WGS84 (EPSG:4326) standard](https://en.wikipedia.org/wiki/World_Geodetic_System#WGS84).
 *
 * Mapbox GL uses longitude, latitude coordinate order (as opposed to latitude, longitude) to match the
 * [GeoJSON specification](https://tools.ietf.org/html/rfc7946).
 *
 * Note that any Mapbox GL method that accepts a `LngLat` object as an argument or option
 * can also accept an `Array` of two numbers and will perform an implicit conversion.
 * This flexible type is documented as {@link LngLatLike}.
 *
 * @param {number} lng Longitude, measured in degrees.
 * @param {number} lat Latitude, measured in degrees.
 * @example
 * var ll = new mapboxgl.LngLat(-123.9749, 40.7736);
 * ll.lng; // = -123.9749
 * @see [Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
 * @see [Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
 * @see [Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
 */
class LngLat {
    lng: number;
    lat: number;

    constructor(lng: number, lat: number) {
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

    /**
     * Returns the approximate distance between a pair of coordinates in meters
     * Uses the Haversine Formula (from R.W. Sinnott, "Virtues of the Haversine", Sky and Telescope, vol. 68, no. 2, 1984, p. 159)
     *
     * @param {LngLat} lngLat coordinates to compute the distance to
     * @returns {number} Distance in meters between the two coordinates.
     * @example
     * var new_york = new mapboxgl.LngLat(-74.0060, 40.7128);
     * var los_angeles = new mapboxgl.LngLat(-118.2437, 34.0522);
     * new_york.distanceTo(los_angeles); // = 3935751.690893987, "true distance" using a non-spherical approximation is ~3966km
     */
    distanceTo(lngLat: LngLat) {
        const rad = Math.PI / 180;
        const lat1 = this.lat * rad;
        const lat2 = lngLat.lat * rad;
        const a = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos((lngLat.lng - this.lng) * rad);

        const maxMeters = earthRadius * Math.acos(Math.min(a, 1));
        return maxMeters;
    }

    /**
     * Returns a `LngLatBounds` from the coordinates extended by a given `radius`. The returned `LngLatBounds` completely contains the `radius`.
     *
     * @param {number} [radius=0] Distance in meters from the coordinates to extend the bounds.
     * @returns {LngLatBounds} A new `LngLatBounds` object representing the coordinates extended by the `radius`.
     * @example
     * var ll = new mapboxgl.LngLat(-73.9749, 40.7736);
     * ll.toBounds(100).toArray(); // = [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]
     */
    toBounds(radius?: number = 0) {
        const earthCircumferenceInMetersAtEquator = 40075017;
        const latAccuracy = 360 * radius / earthCircumferenceInMetersAtEquator,
            lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

        return new LngLatBounds(new LngLat(this.lng - lngAccuracy, this.lat - latAccuracy),
            new LngLat(this.lng + lngAccuracy, this.lat + latAccuracy));
    }

    /**
     * Converts an array of two numbers or an object with `lng` and `lat` or `lon` and `lat` properties
     * to a `LngLat` object.
     *
     * If a `LngLat` object is passed in, the function returns it unchanged.
     *
     * @param {LngLatLike} input An array of two numbers or object to convert, or a `LngLat` object to return.
     * @returns {LngLat} A new `LngLat` object, if a conversion occurred, or the original `LngLat` object.
     * @example
     * var arr = [-73.9749, 40.7736];
     * var ll = mapboxgl.LngLat.convert(arr);
     * ll;   // = LngLat {lng: -73.9749, lat: 40.7736}
     */
    static convert(input: LngLatLike): LngLat {
        if (input instanceof LngLat) {
            return input;
        }
        if (Array.isArray(input) && (input.length === 2 || input.length === 3)) {
            return new LngLat(Number(input[0]), Number(input[1]));
        }
        if (!Array.isArray(input) && typeof input === 'object' && input !== null) {
            return new LngLat(
                // flow can't refine this to have one of lng or lat, so we have to cast to any
                Number('lng' in input ? (input: any).lng : (input: any).lon),
                Number(input.lat)
            );
        }
        throw new Error("`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, an object {lon: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]");
    }
}

/**
 * A {@link LngLat} object, an array of two numbers representing longitude and latitude,
 * or an object with `lng` and `lat` or `lon` and `lat` properties.
 *
 * @typedef {LngLat | {lng: number, lat: number} | {lon: number, lat: number} | [number, number]} LngLatLike
 * @example
 * var v1 = new mapboxgl.LngLat(-122.420679, 37.772537);
 * var v2 = [-122.420679, 37.772537];
 * var v3 = {lon: -122.420679, lat: 37.772537};
 */
export type LngLatLike = LngLat | {lng: number, lat: number} | {lon: number, lat: number} | [number, number];

export default LngLat;
