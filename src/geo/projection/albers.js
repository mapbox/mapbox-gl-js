// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import {vec2} from 'gl-matrix';

export default {
    name: 'albers',
    range: [4, 7],

    center: [-96, 37.5],
    parallels: [29.5, 45.5],

    conic: true,

    // based on https://github.com/d3/d3-geo-projection, MIT-licensed

    initializeConstants() {
        if (this.constants && vec2.exactEquals(this.parallels, this.constants.parallels)) {
            return;
        }

        const sy0 = Math.sin(degToRad(this.parallels[0]));
        const n = (sy0 + Math.sin(degToRad(this.parallels[1]))) / 2;
        const c = 1 + sy0 * (2 * n - sy0);
        const r0 = Math.sqrt(c) / n;

        this.constants = {n, c, r0, parallels: this.parallels};
    },
    project(lng: number, lat: number) {
        this.initializeConstants();

        const lng_ = degToRad(lng - this.center[0]);
        const lat_ = degToRad(lat);

        const {n, c, r0} = this.constants;
        const r = Math.sqrt(c - 2 * n * Math.sin(lat_)) / n;
        const x = r * Math.sin(lng_ * n);
        const y = r0 - r * Math.cos(lng_ * n);
        return {x, y: -y};
    },
    unproject(x: number, y: number) {
        this.initializeConstants();
        const {n, c, r0} = this.constants;

        y = -y;

        const r0y = r0 - y;
        let l = Math.atan2(x, Math.abs(r0y)) * Math.sign(r0y);
        if (r0y * n < 0) {
            l -= Math.PI * Math.sign(x) * Math.sign(r0y);
        }
        const lng = l / n;
        const lat = Math.asin(clamp((c - (x * x + r0y * r0y) * n * n) / (2 * n), -1, 1));

        return new LngLat(
            radToDeg(lng) + this.center[0],
            clamp(radToDeg(lat), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE));
    }
};
