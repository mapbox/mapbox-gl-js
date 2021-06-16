// @flow
import LngLat from '../lng_lat.js';

export default {
    name: 'sinusoidal',
    range: [],
    project(lng: number, lat: number) {
        const x = 0.5 + lng * Math.cos(lat / 180 * Math.PI) / 360 * 2;
        const y = 0.5 - lat / 360 * 2;
        return {x, y};
    },
    unproject: (x: number, y: number) => {
        const lat = (0.5 - y) / 2 * 360;
        const lng = (x - 0.5) / Math.cos(lat / 180 * Math.PI) / 2 * 360;
        return new LngLat(lng, lat);
    }
};
