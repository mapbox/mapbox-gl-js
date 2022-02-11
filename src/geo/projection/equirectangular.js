// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import Projection from './projection.js';

import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {ProjectedPoint} from './projection.js';

export default class Equirectangular extends Projection {

    constructor(options: ProjectionSpecification) {
        super(options);
        this.wrap = true;
        this.supportsWorldCopies = true;
    }

    project(lng: number, lat: number): ProjectedPoint {
        const x = 0.5 + lng / 360;
        const y = 0.5 - lat / 360;
        return {x, y, z: 0};
    }

    unproject(x: number, y: number): LngLat {
        const lng = (x - 0.5) * 360;
        const lat = clamp((0.5 - y) * 360, -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
        return new LngLat(lng, lat);
    }
}
