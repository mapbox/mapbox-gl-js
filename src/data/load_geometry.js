// @flow

import {warnOnce, clamp} from '../util/util.js';

import EXTENT from './extent.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
import projections from '../geo/projection/index.js';
import type {CanonicalTileID} from '../source/tile_id.js';

import type Point from '@mapbox/point-geometry';

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain coordinates within [-Infinity, Infinity]. Our range is limited by the
// number of bits used to represent the coordinate.
const BITS = 15;
const MAX = Math.pow(2, BITS - 1) - 1;
const MIN = -MAX - 1;

let projection;

export function setProjection(projectionName: string) {
    projection = projections[projectionName];
}

function resample(ring) {
    if (ring.length === 0) return [];
    const result = [];
    result.push(ring[0]);
    for (let i = 1; i < ring.length; i++) {
        const last = result[result.length - 1];
        const p = ring[i];
        const d = p.dist(last);
        const m = 16;
        for (let i = m; i < d; i += m) {
            result.push(last.add(p.sub(last).mult(i / d)));
        }
        result.push(p);
    }
    return result;
}

function reproject(p, featureExtent, canonical) {
    const cs = projection.tileTransform(canonical);
    const s = Math.pow(2, canonical.z);
    const x_ = (canonical.x + p.x / featureExtent) / s;
    const y_ = (canonical.y + p.y / featureExtent) / s;
    const l = new MercatorCoordinate(x_, y_).toLngLat();
    const {x, y} = projection.project(l.lng, l.lat);
    p.x = (x * cs.scale - cs.x) * EXTENT;
    p.y = (y * cs.scale - cs.y) * EXTENT;
}

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @private
 */
export default function loadGeometry(feature: VectorTileFeature, canonical?: CanonicalTileID): Array<Array<Point>> {
    const geometry = feature.loadGeometry();
    for (let r = 0; r < geometry.length; r++) {
        let ring = geometry[r];
        ring = resample(ring);
        geometry[r] = ring;
        for (let p = 0; p < ring.length; p++) {
            const point = ring[p];
            let x, y;
            if (canonical) {
                reproject(point, feature.extent, canonical);
                x = point.x;
                y = point.y;
            } else {
                const scale = EXTENT / feature.extent;
                // round here because mapbox-gl-native uses integers to represent
                // points and we need to do the same to avoid rendering differences.
                x = Math.round(point.x * scale);
                y = Math.round(point.y * scale);
            }

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
