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
    const extent = feature.extent;
    const extentScale = EXTENT / extent;

    if (canonical && tileTransform && tileTransform.projection.isReprojectedInTileSpace) {
        const z2 = 1 << canonical.z;
        const {scale, x, y, projection} = tileTransform;

        const reproject = (p) => {
            const lng = lngFromMercatorX((canonical.x + p.x / extent) / z2);
            const lat = latFromMercatorY((canonical.y + p.y / extent) / z2);
            const p2 = projection.project(lng, lat);
            p.x = (p2.x * scale - x) * extent;
            p.y = (p2.y * scale - y) * extent;
        };

        for (let i = 0; i < geometry.length; i++) {
            if (feature.type !== 1) {
                geometry[i] = resample(geometry[i], reproject, 1); // resample lines and polygons

            } else { // points
                const line = [];
                for (const p of geometry[i]) {
                    // filter out point features outside tile boundaries now; it'd be harder to do later
                    // when the coords are reprojected and no longer axis-aligned; ideally this would happen
                    // or not depending on how the geometry is used, but we forego the complexity for now
                    if (p.x < 0 || p.x >= extent || p.y < 0 || p.y >= extent) continue;
                    reproject(p);
                    line.push(p);
                }
                geometry[i] = line;
            }
        }
    }

    for (const line of geometry) {
        for (const p of line) {
            preparePoint(p, extentScale);
        }
    }

    return geometry;
}
