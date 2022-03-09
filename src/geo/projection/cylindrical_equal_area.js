// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import Projection from './projection.js';

import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {ProjectedPoint} from './projection.js';

export default class CylindricalEqualArea extends Projection {
    cosPhi: number;
    scale: number;

    constructor(options: ProjectionSpecification) {
        super(options);
        this.center = options.center || [0, 0];
        this.parallels = options.parallels || [0, 0];
        this.cosPhi = Math.max(0.01, Math.cos(degToRad(this.parallels[0])));
        // scale coordinates between 0 and 1 to avoid constraint issues
        this.scale = 1 / (2 * Math.max(Math.PI * this.cosPhi, 1 / this.cosPhi));
        this.wrap = true;
        this.supportsWorldCopies = true;
    }

    project(lng: number, lat: number): ProjectedPoint {
        const {scale, cosPhi} = this;
        const x = degToRad(lng) * cosPhi;
        const y = Math.sin(degToRad(lat)) / cosPhi;

        return {
            x: (x * scale) + 0.5,
            y: (-y * scale) + 0.5,
            z: 0
        };
    }

    unproject(x: number, y: number): LngLat {
        const {scale, cosPhi} = this;
        const x_ = (x - 0.5) / scale;
        const y_ = -(y - 0.5) / scale;
        const lng = clamp(radToDeg(x_) / cosPhi, -180, 180);
        const y2 = y_ * cosPhi;
        const y3 = Math.asin(clamp(y2, -1, 1));
        const lat = clamp(radToDeg(y3), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

        return new LngLat(lng, lat);
    }
}
