// @flow
import assert from 'assert';
import {wrap, degToRad, radToDeg} from '../util/util.js';
import {GLOBE_RADIUS} from '../geo/projection/globe_constants.js';

import type {Vec3} from 'gl-matrix';

export function csLatLngToECEF(cosLat: number, sinLat: number, lng: number, radius: number = GLOBE_RADIUS): Vec3 {
    lng = degToRad(lng);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = cosLat * Math.sin(lng) * radius;
    const sy = -sinLat * radius;
    const sz = cosLat * Math.cos(lng) * radius;

    return [sx, sy, sz];
}

export function ecefToLatLng([x, y, z]: Array<number>): LngLat {
    const radius = Math.hypot(x, y, z);
    const lng = Math.atan2(x, z);
    const lat = Math.PI * 0.5 - Math.acos(-y / radius);

    return new LngLat(radToDeg(lng), radToDeg(lat));
}

export function latLngToECEF(lat: number, lng: number, radius?: number): Vec3 {
    assert(lat <= 90 && lat >= -90, 'Lattitude must be between -90 and 90');
    return csLatLngToECEF(Math.cos(degToRad(lat)), Math.sin(degToRad(lat)), lng, radius);
}

/*
* Approximate radius of the earth in meters.
* Uses the WGS-84 approximation. The radius at the equator is ~6378137 and at the poles is ~6356752. https://en.wikipedia.org/wiki/World_Geodetic_System#WGS84
* 6371008.8 is one published "average radius" see https://en.wikipedia.org/wiki/Earth_radius#Mean_radius, or ftp://athena.fsv.cvut.cz/ZFG/grs80-Moritz.pdf p.4
*/
export const earthRadius = 6371008.8;

/*
 * The average circumference of the earth in meters.
 */
export const earthCircumference = 2 * Math.PI * earthRadius;

/**
 * A `LngLat` object represents a given longitude and latitude coordinate, measured in degrees.
 * These coordinates use longitude, latitude coordinate order (as opposed to latitude, longitude)
 * to match the [GeoJSON specification](https://datatracker.ietf.org/doc/html/rfc7946#section-4),
 * which is equivalent to the OGC:CRS84 coordinate reference system.
 *
 * Note that any Mapbox GL method that accepts a `LngLat` object as an argument or option
 * can also accept an `Array` of two numbers and will perform an implicit conversion.
 * This flexible type is documented as {@link LngLatLike}.
 *
 * @param {number} lng Longitude, measured in degrees.
 * @param {number} lat Latitude, measured in degrees.
 * @example
 * const ll = new mapboxgl.LngLat(-123.9749, 40.7736);
 * console.log(ll.lng); // = -123.9749
 * @see [Example: Get coordinates of the mouse pointer](https://www.mapbox.com/mapbox-gl-js/example/mouse-position/)
 * @see [Example: Display a popup](https://www.mapbox.com/mapbox-gl-js/example/popup/)
 * @see [Example: Highlight features within a bounding box](https://www.mapbox.com/mapbox-gl-js/example/using-box-queryrenderedfeatures/)
 * @see [Example: Create a timeline animation](https://www.mapbox.com/mapbox-gl-js/example/timeline-animation/)
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
     * const ll = new mapboxgl.LngLat(286.0251, 40.7736);
     * const wrapped = ll.wrap();
     * console.log(wrapped.lng); // = -73.9749
     */
    wrap(): LngLat {
        return new LngLat(wrap(this.lng, -180, 180), this.lat);
    }

    /**
     * Returns the coordinates represented as an array of two numbers.
     *
     * @returns {Array<number>} The coordinates represeted as an array of longitude and latitude.
     * @example
     * const ll = new mapboxgl.LngLat(-73.9749, 40.7736);
     * ll.toArray(); // = [-73.9749, 40.7736]
     */
    toArray(): [number, number] {
        return [this.lng, this.lat];
    }

    /**
     * Returns the coordinates represent as a string.
     *
     * @returns {string} The coordinates represented as a string of the format `'LngLat(lng, lat)'`.
     * @example
     * const ll = new mapboxgl.LngLat(-73.9749, 40.7736);
     * ll.toString(); // = "LngLat(-73.9749, 40.7736)"
     */
    toString(): string {
        return `LngLat(${this.lng}, ${this.lat})`;
    }

    /**
     * Returns the approximate distance between a pair of coordinates in meters.
     * Uses the Haversine Formula (from R.W. Sinnott, "Virtues of the Haversine", Sky and Telescope, vol. 68, no. 2, 1984, p. 159).
     *
     * @param {LngLat} lngLat Coordinates to compute the distance to.
     * @returns {number} Distance in meters between the two coordinates.
     * @example
     * const newYork = new mapboxgl.LngLat(-74.0060, 40.7128);
     * const losAngeles = new mapboxgl.LngLat(-118.2437, 34.0522);
     * newYork.distanceTo(losAngeles); // = 3935751.690893987, "true distance" using a non-spherical approximation is ~3966km
     */
    distanceTo(lngLat: LngLat): number {
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
     * const ll = new mapboxgl.LngLat(-73.9749, 40.7736);
     * ll.toBounds(100).toArray(); // = [[-73.97501862141328, 40.77351016847229], [-73.97478137858673, 40.77368983152771]]
     */
    toBounds(radius?: number = 0): LngLatBounds {
        const earthCircumferenceInMetersAtEquator = 40075017;
        const latAccuracy = 360 * radius / earthCircumferenceInMetersAtEquator,
            lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);

        return new LngLatBounds({lng: this.lng - lngAccuracy, lat: this.lat - latAccuracy},
            {lng: this.lng + lngAccuracy, lat: this.lat + latAccuracy});
    }

    toEcef(altitude: number): [number, number, number] {
        const altInEcef = altitude * GLOBE_RADIUS / earthRadius;
        const radius = GLOBE_RADIUS + altInEcef;
        return (latLngToECEF(this.lat, this.lng, radius): any);
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
     * const arr = [-73.9749, 40.7736];
     * const ll = mapboxgl.LngLat.convert(arr);
     * console.log(ll);   // = LngLat {lng: -73.9749, lat: 40.7736}
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
 * const v1 = new mapboxgl.LngLat(-122.420679, 37.772537);
 * const v2 = [-122.420679, 37.772537];
 * const v3 = {lon: -122.420679, lat: 37.772537};
 */
export type LngLatLike = LngLat | {lng: number, lat: number} | {lon: number, lat: number} | [number, number];

export default LngLat;

/**
 * A `LngLatBounds` object represents a geographical bounding box,
 * defined by its southwest and northeast points in longitude and latitude.
 *
 * If no arguments are provided to the constructor, a `null` bounding box is created.
 *
 * Note that any Mapbox GL method that accepts a `LngLatBounds` object as an argument or option
 * can also accept an `Array` of two {@link LngLatLike} constructs and will perform an implicit conversion.
 * This flexible type is documented as {@link LngLatBoundsLike}.
 *
 * @param {LngLatLike} [sw] The southwest corner of the bounding box.
 * @param {LngLatLike} [ne] The northeast corner of the bounding box.
 * @example
 * const sw = new mapboxgl.LngLat(-73.9876, 40.7661);
 * const ne = new mapboxgl.LngLat(-73.9397, 40.8002);
 * const llb = new mapboxgl.LngLatBounds(sw, ne);
 */
export class LngLatBounds {
    _ne: LngLat;
    _sw: LngLat;

    // This constructor is too flexible to type. It should not be so flexible.
    constructor(sw: any, ne: any) {
        if (!sw) {
            // noop
        } else if (ne) {
            this.setSouthWest(sw).setNorthEast(ne);
        } else if (sw.length === 4) {
            this.setSouthWest([sw[0], sw[1]]).setNorthEast([sw[2], sw[3]]);
        } else {
            this.setSouthWest(sw[0]).setNorthEast(sw[1]);
        }
    }

    /**
     * Set the northeast corner of the bounding box.
     *
     * @param {LngLatLike} ne A {@link LngLatLike} object describing the northeast corner of the bounding box.
     * @returns {LngLatBounds} Returns itself to allow for method chaining.
     * @example
     * const sw = new mapboxgl.LngLat(-73.9876, 40.7661);
     * const ne = new mapboxgl.LngLat(-73.9397, 40.8002);
     * const llb = new mapboxgl.LngLatBounds(sw, ne);
     * llb.setNorthEast([-73.9397, 42.8002]);
     */
    setNorthEast(ne: LngLatLike): this {
        this._ne = ne instanceof LngLat ? new LngLat(ne.lng, ne.lat) : LngLat.convert(ne);
        return this;
    }

    /**
     * Set the southwest corner of the bounding box.
     *
     * @param {LngLatLike} sw A {@link LngLatLike} object describing the southwest corner of the bounding box.
     * @returns {LngLatBounds} Returns itself to allow for method chaining.
     * @example
     * const sw = new mapboxgl.LngLat(-73.9876, 40.7661);
     * const ne = new mapboxgl.LngLat(-73.9397, 40.8002);
     * const llb = new mapboxgl.LngLatBounds(sw, ne);
     * llb.setSouthWest([-73.9876, 40.2661]);
     */
    setSouthWest(sw: LngLatLike): this {
        this._sw = sw instanceof LngLat ? new LngLat(sw.lng, sw.lat) : LngLat.convert(sw);
        return this;
    }

    /**
     * Extend the bounds to include a given LngLatLike or LngLatBoundsLike.
     *
     * @param {LngLatLike|LngLatBoundsLike} obj Object to extend to.
     * @returns {LngLatBounds} Returns itself to allow for method chaining.
     * @example
     * const sw = new mapboxgl.LngLat(-73.9876, 40.7661);
     * const ne = new mapboxgl.LngLat(-73.9397, 40.8002);
     * const llb = new mapboxgl.LngLatBounds(sw, ne);
     * llb.extend([-72.9876, 42.2661]);
     */
    extend(obj: LngLatLike | LngLatBoundsLike): this {
        const sw = this._sw,
            ne = this._ne;
        let sw2, ne2;

        if (obj instanceof LngLat) {
            sw2 = obj;
            ne2 = obj;

        } else if (obj instanceof LngLatBounds) {
            sw2 = obj._sw;
            ne2 = obj._ne;

            if (!sw2 || !ne2) return this;

        } else if (Array.isArray(obj)) {
            // $FlowFixMe[method-unbinding]
            if (obj.length === 4 || obj.every(Array.isArray)) {
                const lngLatBoundsObj = ((obj: any): LngLatBoundsLike);
                return this.extend(LngLatBounds.convert(lngLatBoundsObj));
            } else {
                const lngLatObj = ((obj: any): LngLatLike);
                return this.extend(LngLat.convert(lngLatObj));
            }
        } else if (typeof obj === 'object' && obj !== null && obj.hasOwnProperty("lat") && (obj.hasOwnProperty("lon") || obj.hasOwnProperty("lng"))) {
            return this.extend(LngLat.convert(obj));
        } else {
            return this;
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
    }

    /**
     * Returns the geographical coordinate equidistant from the bounding box's corners.
     *
     * @returns {LngLat} The bounding box's center.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getCenter(); // = LngLat {lng: -73.96365, lat: 40.78315}
     */
    getCenter(): LngLat {
        return new LngLat((this._sw.lng + this._ne.lng) / 2, (this._sw.lat + this._ne.lat) / 2);
    }

    /**
     * Returns the southwest corner of the bounding box.
     *
     * @returns {LngLat} The southwest corner of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getSouthWest(); // LngLat {lng: -73.9876, lat: 40.7661}
     */
    getSouthWest(): LngLat { return this._sw; }

    /**
     * Returns the northeast corner of the bounding box.
     *
     * @returns {LngLat} The northeast corner of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getNorthEast(); // LngLat {lng: -73.9397, lat: 40.8002}
     */
    getNorthEast(): LngLat { return this._ne; }

    /**
     * Returns the northwest corner of the bounding box.
     *
     * @returns {LngLat} The northwest corner of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getNorthWest(); // LngLat {lng: -73.9876, lat: 40.8002}
     */
    getNorthWest(): LngLat { return new LngLat(this.getWest(), this.getNorth()); }

    /**
     * Returns the southeast corner of the bounding box.
     *
     * @returns {LngLat} The southeast corner of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getSouthEast(); // LngLat {lng: -73.9397, lat: 40.7661}
     */
    getSouthEast(): LngLat { return new LngLat(this.getEast(), this.getSouth()); }

    /**
     * Returns the west edge of the bounding box.
     *
     * @returns {number} The west edge of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getWest(); // -73.9876
     */
    getWest(): number { return this._sw.lng; }

    /**
     * Returns the south edge of the bounding box.
     *
     * @returns {number} The south edge of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getSouth(); // 40.7661
     */
    getSouth(): number { return this._sw.lat; }

    /**
     * Returns the east edge of the bounding box.
     *
     * @returns {number} The east edge of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getEast(); // -73.9397
     */
    getEast(): number { return this._ne.lng; }

    /**
     * Returns the north edge of the bounding box.
     *
     * @returns {number} The north edge of the bounding box.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.getNorth(); // 40.8002
     */
    getNorth(): number { return this._ne.lat; }

    /**
     * Returns the bounding box represented as an array.
     *
     * @returns {Array<Array<number>>} The bounding box represented as an array, consisting of the
     *     southwest and northeast coordinates of the bounding represented as arrays of numbers.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toArray(); // = [[-73.9876, 40.7661], [-73.9397, 40.8002]]
     */
    toArray(): [[number, number], [number, number]] {
        return [this._sw.toArray(), this._ne.toArray()];
    }

    /**
     * Return the bounding box represented as a string.
     *
     * @returns {string} The bounding box represents as a string of the format
     *     `'LngLatBounds(LngLat(lng, lat), LngLat(lng, lat))'`.
     * @example
     * const llb = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
     * llb.toString(); // = "LngLatBounds(LngLat(-73.9876, 40.7661), LngLat(-73.9397, 40.8002))"
     */
    toString(): string {
        return `LngLatBounds(${this._sw.toString()}, ${this._ne.toString()})`;
    }

    /**
     * Check if the bounding box is an empty/`null`-type box.
     *
     * @returns {boolean} True if bounds have been defined, otherwise false.
     * @example
     * const llb = new mapboxgl.LngLatBounds();
     * llb.isEmpty(); // true
     * llb.setNorthEast([-73.9876, 40.7661]);
     * llb.setSouthWest([-73.9397, 40.8002]);
     * llb.isEmpty(); // false
     */
    isEmpty(): boolean {
        return !(this._sw && this._ne);
    }

    /**
    * Check if the point is within the bounding box.
    *
    * @param {LngLatLike} lnglat Geographic point to check against.
    * @returns {boolean} True if the point is within the bounding box.
    * @example
    * const llb = new mapboxgl.LngLatBounds(
    *   new mapboxgl.LngLat(-73.9876, 40.7661),
    *   new mapboxgl.LngLat(-73.9397, 40.8002)
    * );
    *
    * const ll = new mapboxgl.LngLat(-73.9567, 40.7789);
    *
    * console.log(llb.contains(ll)); // = true
    */
    contains(lnglat: LngLatLike): boolean {
        const {lng, lat} = LngLat.convert(lnglat);

        const containsLatitude = this._sw.lat <= lat && lat <= this._ne.lat;
        let containsLongitude = this._sw.lng <= lng && lng <= this._ne.lng;
        if (this._sw.lng > this._ne.lng) { // wrapped coordinates
            containsLongitude = this._sw.lng >= lng && lng >= this._ne.lng;
        }

        return containsLatitude && containsLongitude;
    }

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
     * const arr = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
     * const llb = mapboxgl.LngLatBounds.convert(arr);
     * console.log(llb);   // = LngLatBounds {_sw: LngLat {lng: -73.9876, lat: 40.7661}, _ne: LngLat {lng: -73.9397, lat: 40.8002}}
     */
    static convert(input: LngLatBoundsLike): LngLatBounds {
        if (!input || input instanceof LngLatBounds) return input;
        return new LngLatBounds(input);
    }
}

/**
 * A {@link LngLatBounds} object, an array of {@link LngLatLike} objects in [sw, ne] order,
 * or an array of numbers in [west, south, east, north] order.
 *
 * @typedef {LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number]} LngLatBoundsLike
 * @example
 * const v1 = new mapboxgl.LngLatBounds(
 *   new mapboxgl.LngLat(-73.9876, 40.7661),
 *   new mapboxgl.LngLat(-73.9397, 40.8002)
 * );
 * const v2 = new mapboxgl.LngLatBounds([-73.9876, 40.7661], [-73.9397, 40.8002]);
 * const v3 = [[-73.9876, 40.7661], [-73.9397, 40.8002]];
 */
export type LngLatBoundsLike = LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number];
