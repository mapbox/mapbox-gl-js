// @flow

import {vec3, vec4} from 'gl-matrix';
import {warnOnce, clamp, degToRad} from '../util/util.js';

import EXTENT from './extent.js';
import CanonicalTileID from '../source/tile_id.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';
import {latLngToECEF, normalizeECEF, tileBoundsOnGlobe} from '../geo/projection/globe.js'

import type Point from '@mapbox/point-geometry';

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
        const normalizationMatrix = normalizeECEF(bounds);

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
                const ecef = latLngToECEF(lat, lng);

                // Normalization is required as only 16 bits are used per component to store the position.
                // TODO: does not work with geometry outside of the tile!
                vec3.transformMat4(ecef, ecef, normalizationMatrix);

                point.x = ecef[0];
                point.y = ecef[1];
                point.z = ecef[2];
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
