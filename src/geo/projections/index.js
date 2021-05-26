import albers from './albers';
import mercator from './mercator';
import sinusoidal from './sinusoidal';
import wgs84 from './wgs84';
import winkelTripel from './winkelTripel';
import MercatorCoordinate from '../mercator_coordinate.js';

export default {
    albers,
    mercator,
    sinusoidal,
    wgs84,
    winkelTripel
};

function idBounds(id) {
    const s = Math.pow(2, -id.z);
    const x1 = (id.x) * s;
    const x2 = (id.x + 1) * s;
    const y1 = (id.y) * s;
    const y2 = (id.y + 1) * s;

    const interp = (a, b, t) => a * (1 - t) + b * t;

    const n = 2;
    const locs = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        locs.push(new MercatorCoordinate(interp(x1, x2, f), y1).toLngLat());
        locs.push(new MercatorCoordinate(interp(x1, x2, f), y2).toLngLat());
        locs.push(new MercatorCoordinate(x1, interp(y1, y2, f)).toLngLat());
        locs.push(new MercatorCoordinate(x2, interp(y1, y2, f)).toLngLat());
    }
    return locs;
}
    
export function makeTileTransform (projection) {
    return (id) => {
        const locs = idBounds(id);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const l of locs) {
            const {x, y} = projection.project(l.lng, l.lat);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
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
}