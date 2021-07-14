// @flow
import {lngFromMercatorX, latFromMercatorY} from '../mercator_coordinate.js';
import {number as interpolate} from '../../style-spec/util/interpolate.js';
import type {Projection} from './index.js';

export default function tileTransform(id: Object, projection: Projection) {
    const s = Math.pow(2, -id.z);
    const x1 = (id.x) * s;
    const x2 = (id.x + 1) * s;
    const y1 = (id.y) * s;
    const y2 = (id.y + 1) * s;
    const lng1 = lngFromMercatorX(x1);
    const lng2 = lngFromMercatorX(x2);
    const lat1 = latFromMercatorY(y1);
    const lat2 = latFromMercatorY(y2);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const n = 2;
    for (let i = 0; i <= n; i++) {
        const lng = lngFromMercatorX(interpolate(x1, x2, i / n));
        const lat = latFromMercatorY(interpolate(y1, y2, i / n));

        const p0 = projection.project(lng, lat1);
        const p1 = projection.project(lng, lat2);
        const p2 = projection.project(lng1, lat);
        const p3 = projection.project(lng2, lat);

        minX = Math.min(minX, p0.x, p1.x, p2.x, p3.x);
        maxX = Math.max(maxX, p0.x, p1.x, p2.x, p3.x);
        minY = Math.min(minY, p0.y, p1.y, p2.y, p3.y);
        maxY = Math.max(maxY, p0.y, p1.y, p2.y, p3.y);
    }

    const max = Math.max(maxX - minX, maxY - minY);
    const scale = 1 / max;
    return {
        scale,
        x: minX * scale,
        y: minY * scale,
        x2: maxX * scale,
        y2: maxY * scale
    };
}
