// @flow
import LngLat from '../lng_lat.js';

export default {
    name: 'wgs84',
    center: [0, 0],
    project(lng: number, lat: number) {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;
        return {x, y};
    },
    unproject(x: number, y: number) {
        return new LngLat(
            (x - 0.5) * 360,
            (0.5 - y) * 360);
    }
};
