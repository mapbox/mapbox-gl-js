// @flow
import LngLat from '../lng_lat.js';
import {clamp, wrap, degToRad, radToDeg, extend} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import type {ProjectionSpecification} from '../../style-spec/types.js';

import cylindricalEqualArea from './cylindrical_equal_area.js';

export default function({
    center = [-96, 37.5],
    parallels = [29.5, 45.5]
}: ProjectionSpecification) {

    const name = 'albers';
    const range: [number, number] = [4, 7];

    // parallels that are equal but with opposite signs (e.g. [10, -10])
    // create a cylindrical projection so we replace the
    // project and unproject functions with equivalent cylindrical version
    if (Math.abs(parallels[0] + parallels[1]) < 0.01) {
        return extend({name, range, center, parallels}, cylindricalEqualArea(parallels[0]));
    }

    const sy0 = Math.sin(degToRad(parallels[0]));
    const n = (sy0 + Math.sin(degToRad(parallels[1]))) / 2;
    const c = 1 + sy0 * (2 * n - sy0);
    const r0 = Math.sqrt(c) / n;

    return {
        name,
        range,
        center,
        parallels,

        // based on https://github.com/d3/d3-geo-projection, MIT-licensed
        project(lng: number, lat: number) {
            const lambda = degToRad(lng - center[0]);
            const phi = degToRad(lat);
            const r = Math.sqrt(c - 2 * n * Math.sin(phi)) / n;
            const x = r * Math.sin(lambda * n);
            const y = r * Math.cos(lambda * n) - r0;
            return {x, y};
        },

        unproject(x: number, y: number) {
            const r0y = r0 + y;
            let l = Math.atan2(x, Math.abs(r0y)) * Math.sign(r0y);
            if (r0y * n < 0) {
                l -= Math.PI * Math.sign(x) * Math.sign(r0y);
            }
            const dt = degToRad(center[0]) * n;
            l = wrap(l, -Math.PI - dt, Math.PI - dt);

            const lng = radToDeg(l / n) + center[0];
            const phi = Math.asin(clamp((c - (x * x + r0y * r0y) * n * n) / (2 * n), -1, 1));
            const lat = clamp(radToDeg(phi), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);

            return new LngLat(lng, lat);
        }
    };
}
