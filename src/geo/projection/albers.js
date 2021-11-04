// @flow
import LngLat from '../lng_lat.js';
import {clamp, wrap, degToRad, radToDeg} from '../../util/util.js';
import {MAX_MERCATOR_LATITUDE} from '../mercator_coordinate.js';
import {vec2} from 'gl-matrix';

export default {
    name: 'albers',
    range: [4, 7],

    center: [-96, 37.5],
    parallels: [29.5, 45.5],

    conic: true,

    initializeConstants() {
        if (this.constants && vec2.exactEquals(this.parallels, this.constants.parallels)) {
            return;
        }

        const p1 = degToRad(this.parallels[0]);
        const p2 = degToRad(this.parallels[1]);
        const sinp1 = Math.sin(p1);
        const cosp1 = Math.cos(p1);
        const cosp12 = cosp1 * cosp1;
        const r = 0.5;
        const n = 0.5 * (sinp1 + Math.sin(p2));
        const c = cosp12 + 2 * n * sinp1;
        const b = r / n * Math.sqrt(c);

        this.constants = {n, b, c, parallels: this.parallels};
    },
    project(lng: number, lat: number) {
        this.initializeConstants();

        const {n, b, c} = this.constants;
        const theta = n * degToRad(lng - this.center[0]);
        const a = 0.5 / n * Math.sqrt(c - 2 * n * Math.sin(degToRad(lat)));
        const x = a * Math.sin(theta);
        const y = b - a * Math.cos(theta);

        return {x: 1 + 0.5 * x, y: 1 - 0.5 * y};
    },
    unproject(x: number, y: number) {
        this.initializeConstants();

        const {n, b, c} = this.constants;
        const x_ = (x - 1) * 2;
        const y_ = (y - 1) * -2;
        const y2 = -(y_ - b);
        const dt = degToRad(this.center[0]) * n;
        const theta = wrap(Math.atan2(x_, y2), -Math.PI - dt, Math.PI - dt);
        const lng = radToDeg(theta / n) + this.center[0];
        const a = x_ / Math.sin(theta);
        const s = clamp((Math.pow(a / 0.5 * n, 2) - c) / (-2 * n), -1, 1);
        const lat = clamp(radToDeg(Math.asin(s)), -MAX_MERCATOR_LATITUDE, MAX_MERCATOR_LATITUDE);
        return new LngLat(lng, lat);
    }
};
