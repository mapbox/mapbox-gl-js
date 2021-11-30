// @flow
import {mercatorXfromLng, mercatorYfromLat, lngFromMercatorX, latFromMercatorY} from '../mercator_coordinate.js';
import LngLat from '../lng_lat.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';

export default (_: ?ProjectionSpecification) => ({
    name: 'mercator',
    wrap: true,
    center: ([0, 0]: [number, number]),
    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y};
    },
    unproject(x: number, y: number) {
        const lng = lngFromMercatorX(x);
        const lat = latFromMercatorY(y);
        return new LngLat(lng, lat);
    }
});
