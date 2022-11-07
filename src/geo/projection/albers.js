// @flow
import LngLat from '../lng_lat.js';
import {clamp, wrap, degToRad, radToDeg} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import Projection from './projection.js';

import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {ProjectedPoint} from './projection.js';

// based on https://github.com/d3/d3-geo-projection, MIT-licensed
export default class Albers extends Projection {
    n: number;
    c: number;
    r0: number;

    constructor(options: ProjectionSpecification) {
        super(options);
        this.range = [4, 7];
        this.center = options.center || [-96, 37.5];
        const [lat0, lat1] = this.parallels = options.parallels || [29.5, 45.5];

        const sy0 = Math.sin(degToRad(lat0));
        this.n = (sy0 + Math.sin(degToRad(lat1))) / 2;
        this.c = 1 + sy0 * (2 * this.n - sy0);
        this.r0 = Math.sqrt(this.c) / this.n;
    }

    project(lng: number, lat: number): ProjectedPoint {
        const {n, c, r0} = this;
        const lambda = degToRad(lng - this.center[0]);
        const phi = degToRad(lat);

        const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
        const x = r * Math.sin(lambda * n);
        const y = r * Math.cos(lambda * n) - r0;
        return {x, y, z: 0};
    }

    unproject(x: number, y: number): LngLat {
        const {n, c, r0} = this;
        const r0y = r0 + y;
        let l = Math.atan2(x, Math.abs(r0y)) * Math.sign(r0y);
        if (r0y * n < 0) {
            l -= Math.PI * Math.sign(x) * Math.sign(r0y);
        }
        const dt = degToRad(this.center[0]) * n;
        l = wrap(l, -Math.PI - dt, Math.PI - dt);

        const lng = clamp(radToDeg(l / n) + this.center[0], -180, 180);
        const phi = Math.asin(clamp((c - (x * x + r0y * r0y) * n * n) / (2 * n), -1, 1));
        const lat = clamp(radToDeg(phi), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

        return new LngLat(lng, lat);
    }
}
