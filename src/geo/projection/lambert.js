// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg, extend} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';
import type {Projection} from './index.js';

import mercator from './mercator.js';

const halfPi = Math.PI / 2;

function tany(y) {
    return Math.tan((halfPi + y) / 2);
}

export default function ({
    center = [0, 30],
    parallels = [30, 30]
}: ProjectionSpecification): Projection {
    const name = 'lambertConformalConic';
    const range: [number, number] = [3.5, 7];

    // parallels that are equal but with opposite signs (e.g. [10, -10])
    // create a cylindrical projection so we replace the
    // project and unproject functions with equivalent cylindrical version
    if (Math.abs(parallels[0] + parallels[1]) < 0.01) {
        return extend(mercator(), {name, range, center, parallels});
    }

    const y0 = degToRad(parallels[0]);
    const y1 = degToRad(parallels[1]);
    const cy0 = Math.cos(y0);
    const n = y0 === y1 ? Math.sin(y0) : Math.log(cy0 / Math.cos(y1)) / Math.log(tany(y1) / tany(y0));
    const f = cy0 * Math.pow(tany(y0), n) / n;

    return {
        name,
        range,
        center,
        parallels,

        project(lng: number, lat: number) {
            // based on https://github.com/d3/d3-geo, MIT-licensed
            lat = degToRad(lat);
            lng = degToRad(lng - center[0]);

            const epsilon = 1e-6;
            if (f > 0) {
                if (lat < -halfPi + epsilon) lat = -halfPi + epsilon;
            } else {
                if (lat > halfPi - epsilon) lat = halfPi - epsilon;
            }

            const r = f / Math.pow(tany(lat), n);
            const x = r * Math.sin(n * lng);
            const y = f - r * Math.cos(n * lng);

            return {
                x: (x / Math.PI + 0.5) * 0.5,
                y: 1 - (y / Math.PI + 0.5) * 0.5
            };
        },

        unproject(x: number, y: number) {
            // based on https://github.com/d3/d3-geo, MIT-licensed
            x = (2 * x - 0.5) * Math.PI;
            y = (2 * (1 - y) - 0.5) * Math.PI;
            const fy = f - y;
            const signFy = Math.sign(fy);
            const r = Math.sign(n) * Math.sqrt(x * x + fy * fy);
            let l = Math.atan2(x, Math.abs(fy)) * signFy;

            if (fy * n < 0) l -= Math.PI * Math.sign(x) * signFy;

            const lng = clamp(radToDeg(l / n) + center[0], -180, 180);
            const phi = 2 * Math.atan(Math.pow(f / r, 1 / n)) - halfPi;
            const lat = clamp(radToDeg(phi), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

            return new LngLat(lng, lat);
        }
    };
}
