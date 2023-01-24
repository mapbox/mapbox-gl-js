// @flow
import Point from '@mapbox/point-geometry';
import MercatorCoordinate, {altitudeFromMercatorZ, lngFromMercatorX, latFromMercatorY} from '../mercator_coordinate.js';
import EXTENT from '../../data/extent.js';
import {vec3} from 'gl-matrix';
import {Aabb} from '../../util/primitives.js';
import {aabbForTileOnGlobe} from './globe_util.js';
import assert from 'assert';
import {CanonicalTileID} from '../../source/tile_id.js';

import type {Vec3} from 'gl-matrix';
import type Projection from './projection.js';
import type Transform from '../transform.js';

export type TileTransform = {
    scale: number,
    x: number,
    y: number,
    x2: number,
    y2: number,
    projection: Projection
};

export default function tileTransform(id: Object, projection: Projection): TileTransform {
    if (!projection.isReprojectedInTileSpace) {
        return {scale: 1 << id.z, x: id.x, y: id.y, x2: id.x + 1, y2: id.y + 1, projection};
    }

    const s = Math.pow(2, -id.z);

    const x1 = (id.x) * s;
    const x2 = (id.x + 1) * s;
    const y1 = (id.y) * s;
    const y2 = (id.y + 1) * s;

    const lng1 = lngFromMercatorX(x1);
    const lng2 = lngFromMercatorX(x2);
    const lat1 = latFromMercatorY(y1);
    const lat2 = latFromMercatorY(y2);

    const p0 = projection.project(lng1, lat1);
    const p1 = projection.project(lng2, lat1);
    const p2 = projection.project(lng2, lat2);
    const p3 = projection.project(lng1, lat2);

    let minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    let minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    let maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    let maxY = Math.max(p0.y, p1.y, p2.y, p3.y);

    // we pick an error threshold for calculating the bbox that balances between performance and precision
    const maxErr = s / 16;

    function processSegment(pa, pb, ax, ay, bx, by) {
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;

        const pm = projection.project(lngFromMercatorX(mx), latFromMercatorY(my));
        const err = Math.max(0, minX - pm.x, minY - pm.y, pm.x - maxX, pm.y - maxY);

        minX = Math.min(minX, pm.x);
        maxX = Math.max(maxX, pm.x);
        minY = Math.min(minY, pm.y);
        maxY = Math.max(maxY, pm.y);

        if (err > maxErr) {
            processSegment(pa, pm, ax, ay, mx, my);
            processSegment(pm, pb, mx, my, bx, by);
        }
    }

    processSegment(p0, p1, x1, y1, x2, y1);
    processSegment(p1, p2, x2, y1, x2, y2);
    processSegment(p2, p3, x2, y2, x1, y2);
    processSegment(p3, p0, x1, y2, x1, y1);

    // extend the bbox by max error to make sure coords don't go past tile extent
    minX -= maxErr;
    minY -= maxErr;
    maxX += maxErr;
    maxY += maxErr;

    const max = Math.max(maxX - minX, maxY - minY);
    const scale = 1 / max;

    return {
        scale,
        x: minX * scale,
        y: minY * scale,
        x2: maxX * scale,
        y2: maxY * scale,
        projection
    };
}

export function tileAABB(tr: Transform, numTiles: number, z: number, x: number, y: number, wrap: number, min: number, max: number, projection: Projection): Aabb {
    if (projection.name === 'globe') {
        const tileId = new CanonicalTileID(z, x, y);
        return aabbForTileOnGlobe(tr, numTiles, tileId);
    }

    const tt = tileTransform({z, x, y}, projection);
    const tx = tt.x / tt.scale;
    const ty = tt.y / tt.scale;
    const tx2 = tt.x2 / tt.scale;
    const ty2 = tt.y2 / tt.scale;

    if (isNaN(tx) || isNaN(tx2) || isNaN(ty) || isNaN(ty2)) {
        assert(false);
    }

    return new Aabb(
        [(wrap + tx) * numTiles, numTiles * ty, min],
        [(wrap  + tx2) * numTiles, numTiles * ty2, max]);
}

export function getTilePoint(tileTransform: TileTransform, {x, y}: interface { x: number, y: number }, wrap: number = 0): Point {
    return new Point(
        ((x - wrap) * tileTransform.scale - tileTransform.x) * EXTENT,
        (y * tileTransform.scale - tileTransform.y) * EXTENT);
}

export function getTileVec3(tileTransform: TileTransform, coord: MercatorCoordinate, wrap: number = 0): Vec3 {
    const x = ((coord.x - wrap) * tileTransform.scale - tileTransform.x) * EXTENT;
    const y = (coord.y * tileTransform.scale - tileTransform.y) * EXTENT;
    return vec3.fromValues(x, y, altitudeFromMercatorZ(coord.z, coord.y));
}
