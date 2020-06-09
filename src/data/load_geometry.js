// @flow

import {warnOnce, clamp} from '../util/util';

import EXTENT from './extent';

import type Point from '@mapbox/point-geometry';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain cordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
const BITS = 15;
const MAX = Math.pow(2, BITS - 1) - 1;
const MIN = -MAX - 1;

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @private
 */
export default function loadGeometry(feature: VectorTileFeature): Array<Array<Point>> {
    const scale = EXTENT / feature.extent;
    const geometry = feature.loadGeometry();
    for (let r = 0; r < geometry.length; r++) {
        const ring = geometry[r];
        for (let p = 0; p < ring.length; p++) {
            const point = ring[p];
            // round here because mapbox-gl-native uses integers to represent
            // points and we need to do the same to avoid renering differences.
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
    }
    return geometry;
}
