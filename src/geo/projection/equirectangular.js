// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';

export default {
    name: 'equirectangular',
    wrap: true,
    center: [0, 0],
    range: [3.5, 7],
    project(lng: number, lat: number) {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;
        return {x, y};
    },
    unproject(x: number, y: number) {
        const lng = (x - 0.5) * 360;
        const lat = clamp((0.5 - y) * 360, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
        return new LngLat(lng, lat);
    }
};
