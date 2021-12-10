// @flow
import LngLat from '../lng_lat.js';
import {
    mercatorXfromLng,
    mercatorYfromLat,
    lngFromMercatorX,
    latFromMercatorY
} from '../mercator_coordinate.js';

export default {
    name: 'mercator',
    wrap: true,
    requiresDraping: false,
    supportsWorldCopies: true,
    supportsTerrain: true,
    supportsFog: true,
    supportsCustomLayers: true,
    supportsFreeCamera: true,
    zAxisUnit: "meters",
    center: [0, 0],

    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y, z: 0};
    },

    unproject(x: number, y: number) {
        const lng = lngFromMercatorX(x);
        const lat = latFromMercatorY(y);
        return new LngLat(lng, lat);
    }
};
