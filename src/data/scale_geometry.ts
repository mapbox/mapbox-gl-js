import {warnOnce, clamp} from '../util/util';
import EXTENT from '../style-spec/data/extent';

import type Point from '@mapbox/point-geometry';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain coordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
const BITS = 15;
const MAX = Math.pow(2, BITS - 1) - 1;
const MIN = -MAX - 1;

function preparePoint(point: Point, scale: number) {
    const x = Math.round(point.x * scale);
    const y = Math.round(point.y * scale);
    point.x = clamp(x, MIN, MAX);
    point.y = clamp(y, MIN, MAX);
    if (x < point.x || x > point.x + 1 || y < point.y || y > point.y + 1) {
        // warn when exceeding allowed extent except for the 1-px-off case
        // https://github.com/mapbox/mapbox-gl-js/issues/8992
        warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
    }
}

/**
 * Scales geometry in place from the given tile extent to the common extent used internally.
 * @private
 */
export function scaleGeometryToExtent(geometry: Array<Array<Point>>, extent: number): Array<Array<Point>> {
    const scale = EXTENT / extent;
    for (const line of geometry) {
        for (const p of line) {
            preparePoint(p, scale);
        }
    }
    return geometry;
}
