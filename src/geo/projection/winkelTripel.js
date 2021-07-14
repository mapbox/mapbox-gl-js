// @flow
import LngLat from '../lng_lat.js';

function sinc(x) {
    return Math.sin(x) / x;
}

function s(n) {
    return (n / (Math.PI) + 0.5) * 0.5;
}

export default {
    name: 'winkel',
    center: [0, 0],
    range: [3.5, 7],

    project(lng: number, lat: number) {
        lat = lat / 180 * Math.PI;
        lng = lng / 180 * Math.PI;
        const phi1 = Math.acos(2 / Math.PI);
        const alpha = Math.acos(Math.cos(lat) * Math.cos(lng / 2));
        const x = 0.5 * (lng * Math.cos(phi1) + (2 * Math.cos(lat) * Math.sin(lng / 2)) / sinc(alpha)) || 0;
        const y = 0.5 * (lat + Math.sin(lat) / sinc(alpha)) || 0;
        return {
            x: s(x),
            y: 1 - s(y)
        };
    },

    unproject(x: number, y: number) {
        // temporary — replace with a proper implementation
        return new LngLat(
            (x - 0.5) * 360,
            (0.5 - y) * 90);
    }
};
