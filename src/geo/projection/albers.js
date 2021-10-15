// @flow
import LngLat from '../lng_lat.js';
import {clamp} from '../../util/util.js';

export default {
    name: 'albers',
    range: [4, 7],

    center: [-96, 37.5],
    parallels: [29.5, 45.5],

    conical: true,

    project(lng: number, lat: number) {
        const p1 = this.parallels[0] / 180 * Math.PI;
        const p2 = this.parallels[1] / 180 * Math.PI;
        const n = 0.5 * (Math.sin(p1) + Math.sin(p2));
        const theta = n * ((lng - this.center[0]) / 180 * Math.PI);
        const c = Math.pow(Math.cos(p1), 2) + 2 * n * Math.sin(p1);
        const r = 0.5;
        const a = r / n * Math.sqrt(c - 2 * n * Math.sin(lat / 180 * Math.PI));
        const b = r / n * Math.sqrt(c - 2 * n * Math.sin(0 / 180 * Math.PI));
        const x = a * Math.sin(theta);
        const y = b - a * Math.cos(theta);
        return {x: 1 + 0.5 * x, y: 1 - 0.5 * y};
    },
    unproject(x: number, y: number) {
        const p1 = this.parallels[0] / 180 * Math.PI;
        const p2 = this.parallels[1] / 180 * Math.PI;
        const n = 0.5 * (Math.sin(p1) + Math.sin(p2));
        const c = Math.pow(Math.cos(p1), 2) + 2 * n * Math.sin(p1);
        const r = 0.5;
        const b = r / n * Math.sqrt(c - 2 * n * Math.sin(0 / 180 * Math.PI));
        const x_ = (x - 1) * 2;
        const y_ = (y - 1) * -2;
        const y2 = -(y_ - b);
        const theta = Math.atan2(x_, y2);
        const lng = clamp((theta / n * 180 / Math.PI) + this.center[0], -180, 180);
        const a = x_ / Math.sin(theta);
        const s = clamp((Math.pow(a / r * n, 2) - c) / (-2 * n), -1, 1);
        const lat = clamp(Math.asin(s) * 180 / Math.PI, -90, 90);
        return new LngLat(lng, lat);
    }
};
