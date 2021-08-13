// @flow
import {mercatorXfromLng, mercatorYfromLat, mercatorZfromAltitude} from '../mercator_coordinate.js';
import LngLat from '../lng_lat.js';

export default {
    name: 'mercator',
    //center: [0, 0],
    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y, z: 0};
    },
    requiresDraping: false,
    supportsWorldCopies: true,
    zAxisUnit: "meters",

    pixelsPerMeter(lat: number, worldSize: number) {
        return mercatorZfromAltitude(1, lat) * worldSize;
    }
//    unproject(x: number, y: number) {
//        return new LngLat(
//            lngFromMercatorX(x),
//            latFromMercatorY(y));
//    }
};