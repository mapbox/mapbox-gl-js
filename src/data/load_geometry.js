// @flow

import {warnOnce, clamp} from '../util/util.js';

import EXTENT from './extent.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';
import resample from '../geo/projection/resample.js';
import Point from '@mapbox/point-geometry';

import type {CanonicalTileID} from '../source/tile_id.js';
import type {TileTransform} from '../geo/projection/tile_transform.js';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain coordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
const BITS = 15;
const MAX = Math.pow(2, BITS - 1) - 1;
const MIN = -MAX - 1;

function clampPoint(point: Point) {
    const {x, y} = point;
    point.x = clamp(x, MIN, MAX);
    point.y = clamp(y, MIN, MAX);
    if (x < point.x || x > point.x + 1 || y < point.y || y > point.y + 1) {
        // warn when exceeding allowed extent except for the 1-px-off case
        // https://github.com/mapbox/mapbox-gl-js/issues/8992
        warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
    }
    return point;
}

// a subset of VectorTileGeometry
type FeatureWithGeometry = {
    extent: number;
    type: 1 | 2 | 3;
    loadGeometry(): Array<Array<Point>>;
}

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @private
 */
export default function loadGeometry(feature: FeatureWithGeometry, canonical?: CanonicalTileID, tileTransform?: TileTransform): Array<Array<Point>> {
    const geometry = feature.loadGeometry();

    if (canonical && tileTransform && tileTransform.projection.name !== 'mercator') {
        const reproject = (p) => {
            const z2 = 1 << canonical.z;
            const {scale, x, y, projection} = tileTransform;
            const lng = lngFromMercatorX((canonical.x + p.x / feature.extent) / z2);
            const lat = latFromMercatorY((canonical.y + p.y / feature.extent) / z2);
            const p2 = projection.project(lng, lat);
            return clampPoint(new Point((p2.x * scale - x) * EXTENT, (p2.y * scale - y) * EXTENT)._round());
        };

        for (let i = 0; i < geometry.length; i++) {
            geometry[i] = feature.type !== 1 ? resample(geometry[i], reproject, 1) : geometry[i].map(reproject);
        }

    } else {
        for (const line of geometry) {
            for (const p of line) {
                clampPoint(p._mult(EXTENT / feature.extent)._round());
            }
        }
    }

    return geometry;
}
