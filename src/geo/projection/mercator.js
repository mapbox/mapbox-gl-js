// @flow
import LngLat from '../lng_lat.js';
import {mercatorXfromLng, mercatorYfromLat, lngFromMercatorX, latFromMercatorY} from '../mercator_coordinate.js';
import Projection from './projection.js';

import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {ProjectedPoint} from './projection.js';

export default class Mercator extends Projection {

    constructor(options: ProjectionSpecification) {
        super(options);
        this.wrap = true;
        this.supportsWorldCopies = true;
        this.supportsTerrain = true;
        this.supportsFog = true;
        this.supportsFreeCamera = true;
        this.isReprojectedInTileSpace = false;
        this.unsupportedLayers = [];
        this.range = null;
    }

    project(lng: number, lat: number): ProjectedPoint {
        const x = mercatorXfromLng(lng);
        const y = mercatorYfromLat(lat);
        return {x, y, z: 0};
    }

    unproject(x: number, y: number): LngLat {
        const lng = lngFromMercatorX(x);
        const lat = latFromMercatorY(y);
        return new LngLat(lng, lat);
    }
}
