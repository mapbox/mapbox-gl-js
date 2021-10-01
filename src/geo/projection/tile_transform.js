// @flow
import {lngFromMercatorX, latFromMercatorY} from '../mercator_coordinate.js';
import type {Projection} from './index.js';

export type TileTransform = {
    scale: number,
    x: number,
    y: number,
    x2: number,
    y2: number,
    projection: Projection
};

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

    const p0 = projection.project(lng1, lat1);
    const p1 = projection.project(lng2, lat1);
    const p2 = projection.project(lng2, lat2);
    const p3 = projection.project(lng1, lat2);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    function extendBox(p) {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
    }

    function processSegment(pa, pb, ax, ay, bx, by) {
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;

        const pm = projection.project(lngFromMercatorX(mx), latFromMercatorY(my));
        const err = Math.hypot((pa.x + pb.x) / 2 - pm.x, (pa.y + pb.y) / 2 - pm.y);

        if (err >= 1 / 8) { // TODO better heuristic for adaptive bbox measurement
            processSegment(pa, pm, ax, ay, mx, my);
            processSegment(pm, pb, mx, my, bx, by);
        } else {
            extendBox(pb);
        }
    }

    processSegment(p0, p1, x1, y1, x2, y1);
    processSegment(p1, p2, x2, y1, x2, y2);
    processSegment(p2, p3, x2, y2, x1, y2);
    processSegment(p3, p0, x1, y2, x1, y1);

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
