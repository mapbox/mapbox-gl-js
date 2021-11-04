// @flow
import LngLat from '../lng_lat.js';
import {clamp, degToRad, radToDeg} from '../../util/util.js';
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
        const theta = Math.atan2(x_, y2);
        const lng = clamp(radToDeg(theta / n) + this.center[0], -180, 180);
        const a = x_ / Math.sin(theta);
        const s = clamp((Math.pow(a / 0.5 * n, 2) - c) / (-2 * n), -1, 1);
        const lat = clamp(radToDeg(Math.asin(s)), -90, 90);
        return new LngLat(lng, lat);
    }
};
