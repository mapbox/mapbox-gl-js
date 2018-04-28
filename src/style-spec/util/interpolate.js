// @flow

import Color from './color';

import { rgb } from 'd3-color';

import {
    interpolateLab,
    interpolateHcl
} from 'd3-interpolate';

export function number(a: number, b: number, t: number) {
    return (a * (1 - t)) + (b * t);
}

export function color(from: Color, to: Color, t: number) {
    return new Color(
        number(from.r, to.r, t),
        number(from.g, to.g, t),
        number(from.b, to.b, t),
        number(from.a, to.a, t)
    );
}

export function lab(a: Color, b: Color, t: number) {
    return Color.parse(interpolateLab(rgb.apply(rgb, a.toArray()), rgb.apply(rgb, b.toArray()))(t));
}

export function hcl(a: Color, b: Color, t: number) {
    return Color.parse(interpolateHcl(rgb.apply(rgb, a.toArray()), rgb.apply(rgb, b.toArray()))(t));
}

export function array(from: Array<number>, to: Array<number>, t: number) {
    return from.map((d, i) => {
        return number(d, to[i], t);
    });
}
