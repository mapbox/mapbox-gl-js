// @flow
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';

export default {
    name: 'mercator',
    range: [],
    project(lng: number, lat: number) {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y};
    },
    unproject: (x: number, y: number) => new MercatorCoordinate(x, y).toLngLat()
};
