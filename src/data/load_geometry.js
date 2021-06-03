// @flow

import {warnOnce, clamp, degToRad} from '../util/util.js';

import EXTENT from './extent.js';
import CanonicalTileID from '../source/tile_id.js';
import {lngFromMercatorX, latFromMercatorY} from '../geo/mercator_coordinate.js';

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
        // Get corner points of the tile in mercator coordinates and
        // convert them to lat&lng presentation
        const tileScale = Math.pow(2, id.z);
        const left = id.x / tileScale;
        const right = (id.x + 1) / tileScale;
        const top = id.y / tileScale;
        const bottom = (id.y + 1) / tileScale;

        const latLngTL = [ latFromMercatorY(top), lngFromMercatorX(left) ];
        const latLngBR = [ latFromMercatorY(bottom), lngFromMercatorX(right) ];

        const lerp = (a, b, t) => a * (1 - t) + b * t;

        const MIN_LAT = latFromMercatorY(bottom + MAX / EXTENT);
        const MAX_LAT = latFromMercatorY(top - MAX / EXTENT);
        const MIN_LNG = lngFromMercatorX(left - MAX / EXTENT);
        const MAX_LNG = lngFromMercatorX(right + MAX / EXTENT);

        // TODO: Compute aabb of the tile on the sphere using zoom=0 as the reference space
        // (this means that diameter of earth is EXTENT / PI, which is also max size of the globe bounds)
        const bounds = {
            min: [ 0, 0, 0 ],
            max: [ 1, 1, 1 ]
        }

        // let minLng = 

        for (let r = 0; r < geometry.length; r++) {
            const ring = geometry[r];
            for (let p = 0; p < ring.length; p++) {
                const point = ring[p];
                // round here because mapbox-gl-native uses integers to represent
                // points and we need to do the same to avoid rendering differences.
                
                // Find lat&lng presentation of the point
                let lat = lerp(latLngTL[0], latLngBR[0], point.y / feature.extent);
                let lng = lerp(latLngTL[1], latLngBR[1], point.x / feature.extent);

                lat = degToRad(clamp(lat, MIN_LAT, MAX_LAT));
                lng = degToRad(clamp(lng, MIN_LNG, MAX_LNG));

                // Convert this to spherical representation. Use zoom=0 as a reference
                const radius = EXTENT / Math.PI / 2.0;

                const sx = Math.cos(lat) * Math.sin(lng) * radius;
                const sy = -Math.sin(lat) * radius;
                const sz = Math.cos(lat) * Math.cos(lng) * radius;

                // TODO: Normalization to the range [bounds_min, bounds_max] should be done
                // in order to support 16bit vertices
                point.x = sx;
                point.y = sy;
                point.z = sz;

                //const x = Math.round(point.x * scale);
                //const y = Math.round(point.y * scale);
                //point.x = clamp(x, MIN, MAX);
                //point.y = clamp(y, MIN, MAX);
    
                // if (x < point.x || x > point.x + 1 || y < point.y || y > point.y + 1) {
                //     // warn when exceeding allowed extent except for the 1-px-off case
                //     // https://github.com/mapbox/mapbox-gl-js/issues/8992
                //     warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
                // }
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
