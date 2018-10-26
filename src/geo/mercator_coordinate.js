// @flow

import LngLat from '../geo/lng_lat';
import type {LngLatLike} from '../geo/lng_lat';

/*
 * The circumference of the world in meters at the given latitude.
 */
function circumferenceAtLatitude(latitude: number) {
    const circumference = 2 * Math.PI * 6378137;
    return circumference * Math.cos(latitude * Math.PI / 180);
}

/**
 * A `MercatorCoordinate` object represents a 3 dimensional position in projected web mercator coordinates.
 *
 * The "world size" used by `MercatorCoordinate` is 1, meaning `MercatorCoordinate(0, 0, 0)` is the north-west
 * corner of the mercator world and `MercatorCoordinate(1, 1, 0)` is the south-east corner of the mercator world.
 *
 * @param {number} x The x component of the position.
 * @param {number} y The y component of the position.
 * @param {number} z The z component of the position.
 * @example
 * var nullIsland = new mapboxgl.MercatorCoordinate(0.5, 0.5, 0);
 *
 * @see [Add a custom style layer](https://www.mapbox.com/mapbox-gl-js/example/custom-style-layer/)
 */
class MercatorCoordinate {
    x: number;
    y: number;
    z: number;

    constructor(x: number, y: number, z?: number) {
        this.x = +x;
        this.y = +y;
        this.z = z === undefined ? 0 : +z;
    }

    /**
     * Project a `LngLat` to a `MercatorCoordinate`.
     *
     * @param {LngLatLike} lngLatLike The location to project.
     * @param {number} altitude The altitude in meters of the position.
     * @returns {MercatorCoordinate} The projected mercator coordinate.
     * @example
     * var coord = mapboxgl.MercatorCoordinate.fromLngLat({ lng: 0, lat: 0}, 0);
     * coord; // MercatorCoordinate(0.5, 0.5, 0)
     */
    static fromLngLat(lngLatLike: LngLatLike, altitude?: number) {
        const lngLat = LngLat.convert(lngLatLike);

        const x = (180 + lngLat.lng) / 360;
        const y = (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lngLat.lat * Math.PI / 360)))) / 360;
        const z = altitude === undefined ? 0 : (altitude / circumferenceAtLatitude(lngLat.lat));
        return new MercatorCoordinate(x, y, z);

    }

    /**
     * Returns the `LatLng` for the coordinate.
     *
     * @returns {LngLat} The `LngLat` object.
     * @example
     * var coord = new mapboxglMercatorCoordinate(0.5, 0.5, 0);
     * var latLng = coord.toLatLng(); // LngLat(0, 0)
     */
    toLngLat() {
        const lng = this.x * 360 - 180;
        const y2 = 180 - this.y * 360;
        const lat = 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
        return new LngLat(lng, lat);
    }

    /**
     * Returns the altitude in meters of the coordinate.
     *
     * @returns {number} The altitude in meters.
     * @example
     * var coord = new mapboxgl.MercatorCoordinate(0, 0, 0.02);
     * coord.toAltitude(); // 6914.281956295339
     */
    toAltitude() {
        const lat = this.toLngLat().lat;
        return this.z * circumferenceAtLatitude(lat);
    }
}

export default MercatorCoordinate;
