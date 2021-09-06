// @flow
import {mercatorXfromLng, mercatorYfromLat, lngFromMercatorX, latFromMercatorY, MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import {clamp} from '../../util/util.js';
import LngLat from '../lng_lat.js';

export default {
    name: 'mercator',
    center: [0, 0],
    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y};
    },
    unproject(x: number, y: number) {
        const lng = lngFromMercatorX(x);
        const lat = clamp(latFromMercatorY(y), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
        return new LngLat(lng, lat);
    }
};
