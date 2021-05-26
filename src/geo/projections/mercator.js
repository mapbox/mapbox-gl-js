import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';

export default {
    project: (lng, lat) => {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);

        return {x, y};
    },
    unproject: (x, y) => new MercatorCoordinate(x, y).toLngLat()
}