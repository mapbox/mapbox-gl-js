// @flow

import {vec3, vec4} from 'gl-matrix';
import {warnOnce, clamp, degToRad} from '../util/util.js';

import EXTENT from './extent.js';
import CanonicalTileID from '../source/tile_id.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';
import {Aabb, Frustum, Ray} from '../util/primitives.js';

import type Point from '@mapbox/point-geometry';

const refRadius = EXTENT / Math.PI / 2.0;

function tileLatLngCorners(id: CanonicalTileID, padding: ?number) {
    const tileScale = Math.pow(2, id.z);
    const left = id.x / tileScale;
    const right = (id.x + 1) / tileScale;
    const top = id.y / tileScale;
    const bottom = (id.y + 1) / tileScale;

    const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
    const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

    return [latLngTL, latLngBR];
}

function latLngToECEF(lat, lng, r) {
    lat = degToRad(lat);
    lng = degToRad(lng);

    // Convert lat & lng to spherical representation. Use zoom=0 as a reference
    const sx = Math.cos(lat) * Math.sin(lng) * r;
    const sy = -Math.sin(lat) * r;
    const sz = Math.cos(lat) * Math.cos(lng) * r;

    // TODO: Normalization to the range [bounds_min, bounds_max] should be done
    // in order to support 16bit vertices
    return [sx, sy, sz];
}

function normalizeECEF(point, bounds: Aabb) {
    const size = vec3.sub([], bounds.max, bounds.min);
    const normPoint = vec3.divide([], vec3.sub([], point, bounds.min), size);

    normPoint[0] = clamp(normPoint[0], 0, 1);
    normPoint[1] = clamp(normPoint[1], 0, 1);
    normPoint[2] = clamp(normPoint[2], 0, 1);

    return normPoint;
}

function tileBoundsOnGlobe(id: CanonicalTileID): Aabb {
    const z = id.z;

    const mn = -refRadius;
    const mx = refRadius;

    if (z === 0) {
        return new Aabb([mn, mn, mn], [mx, mx, mx]);
    } else if (z === 1) {
        if (id.x === 0 && id.y === 0) {
            return new Aabb([mn, mn, mn], [0, 0, mx]);
        } else if (id.x === 1 && id.y === 0) {
            return new Aabb([0, mn, mn], [mx, 0, mx]);
        } else if (id.x === 0 && id.y === 1) {
            return new Aabb([mn, 0, mn], [0, mx, mx]);
        } else if (id.x === 1 && id.y === 1) {
            return new Aabb([0, 0, mn], [mx, mx, mx]);
        }
    }

    // After zoom 1 surface function is monotonic for all tile patches
    // => it is enough to project corner points
    const [min, max] = tileLatLngCorners(id);

    const corners = [
        latLngToECEF(min[0], min[1], refRadius),
        latLngToECEF(min[0], max[1], refRadius),
        latLngToECEF(max[0], min[1], refRadius),
        latLngToECEF(max[0], max[1], refRadius)
    ];

    const bMin = [mx, mx, mx];
    const bMax = [mn, mn, mn];

    for (const p of corners) {
        bMin[0] = Math.min(bMin[0], p[0]);
        bMin[1] = Math.min(bMin[1], p[1]);
        bMin[2] = Math.min(bMin[2], p[2]);

        bMax[0] = Math.max(bMax[0], p[0]);
        bMax[1] = Math.max(bMax[1], p[1]);
        bMax[2] = Math.max(bMax[2], p[2]);
    }

    return new Aabb(bMin, bMax);
}

// These bounds define the minimum and maximum supported coordinate values.
// While visible coordinates are within [0, EXTENT], tiles may theoretically
// contain coordinates within [-Infinity, Infinity]. Our range is limited by the
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
export default function loadGeometry(feature: VectorTileFeature, id: ?CanonicalTileID): Array<Array<Point>> {
    const scale = EXTENT / feature.extent;
    const geometry = feature.loadGeometry();

    if (id) {
        // TODO: Compute aabb of the tile on the sphere using zoom=0 as the reference space
        // (this means that diameter of earth is EXTENT / PI, which is also max size of the globe bounds)
        const bounds = tileBoundsOnGlobe(id);
        const tiles = Math.pow(2.0, id.z);

        for (let r = 0; r < geometry.length; r++) {
            const ring = geometry[r];
            for (let p = 0; p < ring.length; p++) {
                const point = ring[p];

                const px = clamp(point.x / feature.extent, MIN / EXTENT, MAX / EXTENT);
                const py = clamp(point.y / feature.extent, MIN / EXTENT, MAX / EXTENT);
                const inside = px >= 0 && px <= 1.0 && py >= 0.0 && py < 1.0;

                // Convert point to an ecef position
                const mercX = (id.x + px) / tiles;
                const mercY = (id.y + py) / tiles;

                const lat = latFromMercatorY(mercY);
                const lng = lngFromMercatorX(mercX);

                let up = latLngToECEF(lat, lng, refRadius);

                // Normalize. TODO: does not work with geometry outside of the tile!
                up = normalizeECEF(up, bounds);

                point.x = up[0] * ((1 << 15) - 1);
                point.y = up[1] * ((1 << 15) - 1);
                point.z = up[2] * ((1 << 15) - 1);
                point.inside = inside;
            }
        }

    } else {
        for (let r = 0; r < geometry.length; r++) {
            const ring = geometry[r];
            for (let p = 0; p < ring.length; p++) {
                const point = ring[p];
                // round here because mapbox-gl-native uses integers to represent
                // points and we need to do the same to avoid rendering differences.
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
    }
    return geometry;
}
