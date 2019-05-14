// @flow

import { warnOnce } from '../util/util';

import EXTENT from './extent';
import { lngFromMercatorX, latFromMercatorY } from '../geo/mercator_coordinate';

import type Point from '@mapbox/point-geometry';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain cordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
function createBounds(bits) {
    return {
        min: -1 * Math.pow(2, bits - 1),
        max: Math.pow(2, bits - 1) - 1
    };
}

const bounds = createBounds(16);

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @private
 */
export default function loadGeometry(feature: VectorTileFeature, tileID): Array<Array<Point>> {
    const z = tileID ? tileID.z : 0;
    const x = tileID ? tileID.x : 0;
    const y = tileID ? tileID.y : 0;
    const s = Math.pow(2, z);
    const scale2 = 1 / (Math.pow(2, z) * feature.extent);
    const scale = EXTENT / feature.extent;
    const translateX = x / Math.pow(2, z);
    const translateY = y / Math.pow(2, z);
    const geometry = feature.loadGeometry();

    const a = latFromMercatorY(translateY);
    const yDiff = latFromMercatorY(translateY) - latFromMercatorY(translateY + 1 / s);
    for (let r = 0; r < geometry.length; r++) {
        const ring = geometry[r];
        for (let p = 0; p < ring.length; p++) {
            const point = ring[p];

            //point.x = Math.round((lngFromMercatorX(translateX + point.x * scale2) + 180) / 360 - translateX* s  * EXTENT);
            point.x = Math.round(point.x * scale);
            point.y = Math.round((-latFromMercatorY(translateY + point.y * scale2) + 90 - (90 - a)) / yDiff * EXTENT);
            // round here because mapbox-gl-native uses integers to represent
            // points and we need to do the same to avoid renering differences.
            //point.x = Math.round(point.x * scale);
            //point.y = Math.round(point.y * scale);

            if (point.x < bounds.min || point.x > bounds.max || point.y < bounds.min || point.y > bounds.max) {
                warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
            }
        }
    }
    return geometry;
}
