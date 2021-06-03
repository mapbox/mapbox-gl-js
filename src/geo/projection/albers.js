// @flow
import LngLat from '../lng_lat.js';

const albersConstants = {
    refLng: -96,
    p1r: 29.5,
    p2r: 45.5
};

const alaskaConstants = {
    refLng: -154,
    p1r: 55,
    p2r: 65
};

function project(lng, lat, constants) {
    const p1 = constants.p1r / 180 * Math.PI;
    const p2 = constants.p2r / 180 * Math.PI;
    const n = 0.5 * (Math.sin(p1) + Math.sin(p2));
    const theta = n * ((lng - constants.refLng) / 180 * Math.PI);
    const c = Math.pow(Math.cos(p1), 2) + 2 * n * Math.sin(p1);
    const r = 0.5;
    const a = r / n * Math.sqrt(c - 2 * n * Math.sin(lat / 180 * Math.PI));
    const b = r / n * Math.sqrt(c - 2 * n * Math.sin(0 / 180 * Math.PI));
    const x = a * Math.sin(theta);
    const y = b - a * Math.cos(theta);
    const ret = {x: 0.5 + 0.5 * x, y: 0.5 + 0.5 * -y};
    ret.x += 0.5;
    ret.y += 0.5;

    return ret;
}

function unproject(x, y, constants) {
    const p1 = constants.p1r / 180 * Math.PI;
    const p2 = constants.p2r / 180 * Math.PI;
    const n = 0.5 * (Math.sin(p1) + Math.sin(p2));
    const c = Math.pow(Math.cos(p1), 2) + 2 * n * Math.sin(p1);
    const r = 0.5;
    const b = r / n * Math.sqrt(c - 2 * n * Math.sin(0 / 180 * Math.PI));
    const x__ = x - 0.5;
    const y__ = y - 0.5;
    const x_ = (x__ - 0.5) * 2;
    const y_ = (y__ - 0.5) * -2;
    const y2 = -(y_ - b);
    const theta = Math.atan2(x_, y2);
    const lng = (theta / n * 180 / Math.PI) + constants.refLng;
    const a = x_ / Math.sin(theta);
    const lat = Math.asin((Math.pow(a / r * n, 2) - c) / (-2 * n)) * 180 / Math.PI;

    return new LngLat(lng, lat);
}

export const albers = {
    name: 'albers',
    range: [3.5, 7],
    project: (lng, lat) => {
        return project(lng, lat, albersConstants);
    },
    unproject: (x, y) => {
        return unproject(x, y, albersConstants);
    }
};

export const alaska = {
    name: 'alaska',
    range: [4, 7],
    project: (lng, lat) => {
        return project(lng, lat, alaskaConstants);
    },
    unproject: (x, y) => {
        return unproject(x, y, alaskaConstants);
    }
};
