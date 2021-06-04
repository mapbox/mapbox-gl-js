// @flow
import MercatorCoordinate, {mercatorXfromLng, mercatorYfromLat} from '../mercator_coordinate.js';
import makeTileTransform from './tile_transform.js';

function project(lng: number, lat: number) {
    const x = mercatorXfromLng(lng);
    const y = mercatorYfromLat(lat);

    return {x, y};
}

export default {
    name: 'mercator',
    range: [],
    project,
    unproject: (x: number, y: number) => new MercatorCoordinate(x, y).toLngLat(),
    tileTransform: makeTileTransform(project)
};
