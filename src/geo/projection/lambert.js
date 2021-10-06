// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';

const halfPi = Math.PI / 2;

function tany(y) {
    return Math.tan((halfPi + y) / 2);
}

function getParams([lat0, lat1]) {
    const y0 = lat0 * Math.PI / 180;
    const y1 = lat1 * Math.PI / 180;
    const cy0 = Math.cos(y0);
    const n = y0 === y1 ? Math.sin(y0) : Math.log(cy0 / Math.cos(y1)) / Math.log(tany(y1) / tany(y0));
    const f = cy0 * Math.pow(tany(y0), n) / n;

    return {n, f};
}

export default {
    name: 'lambert',
    range: [3.5, 7],

    center: [0, 30],
    parallels: [30, 30],

    project(lng: number, lat: number) {
        // based on https://github.com/d3/d3-geo, MIT-licensed
        lat = lat / 180 * Math.PI;
        lng = lng / 180 * Math.PI;

        const epsilon = 1e-6;
        const {n, f} = getParams(this.parallels);

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
        const {n, f} = getParams(this.parallels);
        const fy = f - y;
        const r = Math.sign(n) * Math.sqrt(x * x + fy * fy);
        let l = Math.atan2(x, Math.abs(fy)) * Math.sign(fy);

        if (fy * n < 0) l -= Math.PI * Math.sign(x) * Math.sign(fy);

        const lng = clamp((l / n)  * 180 / Math.PI, -180, 180);
        const lat = clamp((2 * Math.atan(Math.pow(f / r, 1 / n)) - halfPi)  * 180 / Math.PI, -90, 90);

        return new LngLat(lng, lat);
    }
};
