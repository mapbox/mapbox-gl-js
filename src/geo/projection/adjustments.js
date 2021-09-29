// @flow

import LngLat from '../lng_lat.js';
import MercatorCoordinate from '../mercator_coordinate.js';
import {mat4} from 'gl-matrix';
import type {Projection} from './index.js';
import type Transform from '../transform.js';

export default function getProjectionAdjustments(transform: Transform) {

    const projection = transform.projection;

    const interpT = getInterpolationT(transform);

    const zoomAdjustment = getZoomAdjustment(projection, transform.center);
    const zoomAdjustmentOrigin = getZoomAdjustment(projection, LngLat.convert(projection.center));
    const scaleAdjustment = Math.pow(2, zoomAdjustment * interpT + (1 - interpT) * zoomAdjustmentOrigin);

    const matrix = getShearAdjustment(transform.projection, transform.zoom, transform.center, interpT);

    mat4.scale(matrix, matrix, [scaleAdjustment, scaleAdjustment, 1]);

    return matrix;
}

function getInterpolationT(transform: Transform) {
    const range = transform.projection.range;
    if (!range) return 0;

    const size = Math.max(transform.width, transform.height);
    const rangeAdjustment = Math.log(size / 1024) / Math.LN2;
    const zoomA = range[0] + rangeAdjustment;
    const zoomB = range[1] + rangeAdjustment;
    const t = Math.max(0, Math.min(1, (transform.zoom - zoomA) / (zoomB - zoomA)));

    return t;
}

/*
 * Calculates the scale difference between Mercator and the given projection at a certain location.
 */
function getZoomAdjustment(projection: Projection, loc: LngLat) {
    const loc2 = new LngLat(loc.lng + 360 / 40000, loc.lat);
    const p1 = projection.project(loc.lng, loc.lat);
    const p2 = projection.project(loc2.lng, loc2.lat);

    const m1 = MercatorCoordinate.fromLngLat(loc);
    const m2 = MercatorCoordinate.fromLngLat(loc2);

    const pdx = p2.x - p1.x;
    const pdy = p2.y - p1.y;
    const mdx = m2.x - m1.x;
    const mdy = m2.y - m1.y;

    const scale = Math.sqrt((mdx * mdx + mdy * mdy) / (pdx * pdx + pdy * pdy));

    return Math.log(scale) / Math.LN2;
}

function getShearAdjustment(projection, zoom, loc, interpT) {

    // create a location a tiny amount (~1km) east of the given location
    const loc2 = new LngLat(loc.lng + 360 / 40000, loc.lat);

    const p1 = projection.project(loc.lng, loc.lat);
    const p2 = projection.project(loc2.lng, loc2.lat);

    const pdx = p2.x - p1.x;
    const pdy = p2.y - p1.y;

    // Calculate how much the map would need to be rotated to make east-west in
    // projected coordinates be left-right
    const angleAdjust = -Math.atan(pdy / pdx) / Math.PI * 180;

    // Find the projected coordinates of two locations, one slightly north and one slightly east.
    // Then calculate the transform that would make the projected coordinates of the two locations be:
    // - equal distances from the original location
    // - perpendicular to one another
    //
    // Only the position of the coordinate to the north is adjusted.
    // The coordinate to the east stays where it is.
    const mc3 = MercatorCoordinate.fromLngLat(loc);
    const offset = 1 / 40000;
    mc3.x += offset;
    const loc3 = mc3.toLngLat();
    const p3 = projection.project(loc3.lng, loc3.lat);
    const pdx3 = p3.x - p1.x;
    const pdy3 = p3.y - p1.y;
    const delta3 = rotate(pdx3, pdy3, angleAdjust);

    const mc4 = MercatorCoordinate.fromLngLat(loc);
    mc4.y += offset;
    const loc4 = mc4.toLngLat();
    const p4 = projection.project(loc4.lng, loc4.lat);
    const pdx4 = p4.x - p1.x;
    const pdy4 = p4.y - p1.y;
    const delta4 = rotate(pdx4, pdy4, angleAdjust);

    const scale = Math.abs(delta3.x) / Math.abs(delta4.y);

    const unrotate = mat4.identity([]);
    mat4.rotateZ(unrotate, unrotate, -angleAdjust / 180 * Math.PI * (1 - interpT));

    // unskew
    const shear = mat4.identity([]);
    mat4.scale(shear, shear, [1, 1 - (1 - scale) * interpT, 1]);
    shear[4] = -delta4.x / delta4.y * interpT;

    // unrotate
    mat4.rotateZ(shear, shear, angleAdjust / 180 * Math.PI);

    mat4.multiply(shear, unrotate, shear);

    return shear;
}

function rotate(x, y, angle) {
    const cos = Math.cos(angle / 180 * Math.PI);
    const sin = Math.sin(angle / 180 * Math.PI);
    return {
        x: x * cos - y * sin,
        y: x * sin + y * cos
    };
}
