// @flow
import {mercatorXfromLng, mercatorYfromLat, lngFromMercatorX, latFromMercatorY} from '../mercator_coordinate.js';
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
//    unproject(x: number, y: number) {
//        return new LngLat(
//            lngFromMercatorX(x),
//            latFromMercatorY(y));
//    }
};