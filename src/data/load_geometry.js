// @flow

import {warnOnce, clamp} from '../util/util.js';

import EXTENT from './extent.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';
import projections from '../geo/projection/index.js';
import tileTransform from '../geo/projection/tile_transform.js';
import Point from '@mapbox/point-geometry';
import type {CanonicalTileID} from '../source/tile_id.js';

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

function pointToLineDist(px, py, ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.abs((ay - py) * dx - (ax - px) * dy) / Math.hypot(dx, dy);
}

/**
 * Loads a geometry from a VectorTileFeature and scales it to the common extent
 * used internally.
 * @param {VectorTileFeature} feature
 * @private
 */
export default function loadGeometry(feature: VectorTileFeature, canonical?: CanonicalTileID): Array<Array<Point>> {
    const featureExtent = feature.extent;
    const scale = EXTENT / featureExtent;
    let cs, z2;
    if (canonical) {
        cs = tileTransform(canonical, projection.project);
        z2 = Math.pow(2, canonical.z);
    }

    function reproject(p) {
        if (projection && projection.name === 'mercator' || !canonical) {
            return new Point(Math.round(p.x * scale), Math.round(p.y * scale));
        } else {
            const lng = lngFromMercatorX((canonical.x + p.x / featureExtent) / z2);
            const lat = latFromMercatorY((canonical.y + p.y / featureExtent) / z2);
            const {x, y} = projection.project(lng, lat);
            return new Point(
                (x * cs.scale - cs.x) * EXTENT,
                (y * cs.scale - cs.y) * EXTENT
            );
        }
    }

    function addResampled(resampled, startMerc, endMerc, startProj, endProj) {
        const midMerc = new Point((startMerc.x + endMerc.x) / 2, (startMerc.y + endMerc.y) / 2);
        const midProj = reproject(midMerc);
        const err = pointToLineDist(midProj.x, midProj.y, startProj.x, startProj.y, endProj.x, endProj.y);

        if (err >= 1) {
            // we're very unlikely to hit max call stack exceeded here,
            // but we might want to safeguard against it in the future
            addResampled(resampled, startMerc, midMerc, startProj, midProj);
            addResampled(resampled, midMerc, endMerc, midProj, endProj);
        } else {
            resampled.push(clampPoint(endProj));
        }
    }

    const geometry = feature.loadGeometry();

    for (let r = 0; r < geometry.length; r++) {
        const ring = geometry[r];
        const resampled = [];

        for (let i = 0, prevMerc, prevProj; i < ring.length; i++) {
            const pointMerc = ring[i];
            const pointProj = reproject(ring[i]);

            if (projection && projection.name !== 'mercator' && prevMerc && prevProj && feature.type !== 1) {
                addResampled(resampled, prevMerc, pointMerc, prevProj, pointProj);
            } else {
                resampled.push(clampPoint(pointProj));
            }

            prevMerc = pointMerc;
            prevProj = pointProj;
        }

        geometry[r] = resampled;
    }

    return geometry;
}
