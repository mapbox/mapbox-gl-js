// @flow

import quickselect from 'quickselect';

import type Point from '@mapbox/point-geometry';

export type GeometryPoint = [number, number] | [number, number, number];
/**
 * Returns the signed area for the polygon ring.  Postive areas are exterior rings and
 * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
 * ordering.
 *
 * @private
 * @param ring Exterior or interior ring
 */
function calculateSignedArea(ring: Array<Point>): number {
    let sum = 0;
    for (let i = 0, len = ring.length, j = len - 1, p1, p2; i < len; j = i++) {
        p1 = ring[i];
        p2 = ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);
    }
    return sum;
}

function compareAreas(a, b) {
    return b.area - a.area;
}

// classifies an array of rings into polygons with outer rings and holes
export function classifyRings(rings: Array<Array<Point>>, maxRings: number) {
    const len = rings.length;

    if (len <= 1) return [rings];

    const polygons = [];
    let polygon,
        ccw;

    for (let i = 0; i < len; i++) {
        const area = calculateSignedArea(rings[i]);
        if (area === 0) continue;

        (rings[i]: any).area = Math.abs(area);

        if (ccw === undefined) ccw = area < 0;

        if (ccw === area < 0) {
            if (polygon) polygons.push(polygon);
            polygon = [rings[i]];

        } else {
            (polygon: any).push(rings[i]);
        }
    }
    if (polygon) polygons.push(polygon);

    // Earcut performance degrades with the # of rings in a polygon. For this
    // reason, we limit strip out all but the `maxRings` largest rings.
    if (maxRings > 1) {
        for (let j = 0; j < polygons.length; j++) {
            if (polygons[j].length <= maxRings) continue;
            quickselect(polygons[j], maxRings, 1, polygons[j].length - 1, compareAreas);
            polygons[j] = polygons[j].slice(0, maxRings);
        }
    }

    return polygons;
}

// minX, minY, maxX, maxY
type BBox = [number, number, number, number];

export function updateBBox(bbox: BBox, coord: Point) {
    bbox[0] = Math.min(bbox[0], coord[0]);
    bbox[1] = Math.min(bbox[1], coord[1]);
    bbox[2] = Math.max(bbox[2], coord[0]);
    bbox[3] = Math.max(bbox[3], coord[1]);
}

export function boxWithinBox(bbox1: BBox, bbox2: BBox) {
    if (bbox1[0] <= bbox2[0]) return false;
    if (bbox1[2] >= bbox2[2]) return false;
    if (bbox1[1] <= bbox2[1]) return false;
    if (bbox1[3] >= bbox2[3]) return false;
    return true;
}

function onBoundary(p: GeometryPoint, p1: GeometryPoint, p2: GeometryPoint) {
    const x1 = p[0] - p1[0];
    const y1 = p[1] - p1[1];
    const x2 = p[0] - p2[0];
    const y2 = p[1] - p2[1];
    return (x1 * y2 - x2 * y1 === 0) && (x1 * x2 <= 0) && (y1 * y2 <= 0);
}

function rayIntersect(p: GeometryPoint, p1: GeometryPoint, p2: GeometryPoint) {
    return ((p1[1] > p[1]) !== (p2[1] > p[1])) && (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0]);
}

// ray casting algorithm for detecting if point is in polygon
export function pointWithinPolygon(point: GeometryPoint, rings: Array<Array<GeometryPoint>>, trueOnBoundary: boolean = false) {
    let inside = false;
    for (let i = 0, len = rings.length; i < len; i++) {
        const ring = rings[i];
        for (let j = 0, len2 = ring.length, k = len2 - 1; j < len2; k = j++) {
            const q1 = ring[k];
            const q2 = ring[j];
            if (onBoundary(point, q1, q2)) return trueOnBoundary;
            if (rayIntersect(point, q1, q2)) inside = !inside;
        }
    }
    return inside;
}

function perp(v1: GeometryPoint, v2: GeometryPoint) {
    return v1[0] * v2[1] - v1[1] * v2[0];
}

// check if p1 and p2 are in different sides of line segment q1->q2
function twoSided(p1: GeometryPoint, p2: GeometryPoint, q1: GeometryPoint, q2: GeometryPoint) {
    // q1->p1 (x1, y1), q1->p2 (x2, y2), q1->q2 (x3, y3)
    const x1 = p1[0] - q1[0];
    const y1 = p1[1] - q1[1];
    const x2 = p2[0] - q1[0];
    const y2 = p2[1] - q1[1];
    const x3 = q2[0] - q1[0];
    const y3 = q2[1] - q1[1];
    const det1 = x1 * y3 - x3 * y1;
    const det2 = x2 * y3 - x3 * y2;
    if ((det1 > 0 && det2 < 0) || (det1 < 0 && det2 > 0)) return true;
    return false;
}
// a, b are end points for line segment1, c and d are end points for line segment2
export function segmentIntersectSegment(a: GeometryPoint, b: GeometryPoint, c: GeometryPoint, d: GeometryPoint) {
    // check if two segments are parallel or not
    // precondition is end point a, b is inside polygon, if line a->b is
    // parallel to polygon edge c->d, then a->b won't intersect with c->d
    const vectorP = [b[0] - a[0], b[1] - a[1]];
    const vectorQ = [d[0] - c[0], d[1] - c[1]];
    if (perp(vectorQ, vectorP) === 0) return false;

    // If lines are intersecting with each other, the relative location should be:
    // a and b lie in different sides of segment c->d
    // c and d lie in different sides of segment a->b
    if (twoSided(a, b, c, d) && twoSided(c, d, a, b)) return true;
    return false;
}

// normalize a degree value into [-180..180] range
function wrap(deg) {
    while (deg < -180) deg += 360;
    while (deg > 180) deg -= 360;
    return deg;
}

const factors = {
    kilometers: 1,
    miles: 1000 / 1609.344,
    nauticalmiles: 1000 / 1852,
    meters: 1000,
    metres: 1000,
    yards: 1000 / 0.9144,
    feet: 1000 / 0.3048,
    inches: 1000 / 0.0254
};

// Values that define WGS84 ellipsoid model of the Earth
const RE = 6378.137; // equatorial radius
const FE = 1 / 298.257223563; // flattening

const E2 = FE * (2 - FE);
const RAD = Math.PI / 180;

/**
 * A collection of very fast approximations to common geodesic measurements. Useful for performance-sensitive code that measures things on a city scale.
 * This is the slim version of https://github.com/mapbox/cheap-ruler
 * @param {number} lat latitude
 * @param {string} [units='kilometers']
 * @returns {CheapRuler}
 * @example
 * const ruler = cheapRuler(35.05, 'miles');
 * //=ruler
 */
export class CheapRuler {
    kx: number;
    ky: number;
    /**
     * Creates a ruler instance for very fast approximations to common geodesic measurements around a certain latitude.
     *
     * @param {number} lat latitude
     * @param {string} [units='kilometers']
     * @returns {CheapRuler}
     * @example
     * const ruler = cheapRuler(35.05, 'miles');
     * //=ruler
     */
    constructor(lat: number, units: string) {
        if (lat === undefined) throw new Error('No latitude given.');
        if (units && !factors[units]) throw new Error(`Unknown unit ${units}. Use one of: ${Object.keys(factors).join(', ')}`);

        // Curvature formulas from https://en.wikipedia.org/wiki/Earth_radius#Meridional
        const m = RAD * RE * (units ? factors[units] : 1);
        const coslat = Math.cos(lat * RAD);
        const w2 = 1 / (1 - E2 * (1 - coslat * coslat));
        const w = Math.sqrt(w2);

        // multipliers for converting longitude and latitude degrees into distance
        this.kx = m * w * coslat;        // based on normal radius of curvature
        this.ky = m * w * w2 * (1 - E2); // based on meridonal radius of curvature
    }

    /**
     * Given two points of the form [longitude, latitude], returns the distance.
     *
     * @param {GeometryPoint} a point [longitude, latitude]
     * @param {GeometryPoint} b point [longitude, latitude]
     * @returns {number} distance
     * @example
     * const distance = ruler.distance([30.5, 50.5], [30.51, 50.49]);
     * //=distance
     */
    distance(a: GeometryPoint, b: GeometryPoint): number {
        const dx = wrap(a[0] - b[0]) * this.kx;
        const dy = (a[1] - b[1]) * this.ky;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Returns the distance from a point `p` to a line segment `a` to `b`.
     *
     * @param {GeometryPoint} p point [longitude, latitude]
     * @param {GeometryPoint} a segment point 1 [longitude, latitude]
     * @param {GeometryPoint} b segment point 2 [longitude, latitude]
     * @returns {number} distance
     * @example
     * const distance = ruler.pointToSegmentDistance([-67.04, 50.5], [-67.05, 50.57], [-67.03, 50.54]);
     * //=distance
     */
    pointToSegmentDistance(p: GeometryPoint, a: GeometryPoint, b: GeometryPoint): number {
        let [x, y] = a;
        let dx = wrap(b[0] - x) * this.kx;
        let dy = (b[1] - y) * this.ky;
        let t = 0;

        if (dx !== 0 || dy !== 0) {
            t = (wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);

            if (t > 1) {
                x = b[0];
                y = b[1];

            } else if (t > 0) {
                x += (dx / this.kx) * t;
                y += (dy / this.ky) * t;
            }
        }

        dx = wrap(p[0] - x) * this.kx;
        dy = (p[1] - y) * this.ky;

        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Returns an object of the form {point, index, t}, where point is closest point on the line
     * from the given point, index is the start index of the segment with the closest point,
     * and t is a parameter from 0 to 1 that indicates where the closest point is on that segment.
     *
     * @param {Array<GeometryPoint>} line
     * @param {GeometryPoint} p point [longitude, latitude]
     * @returns {Object} {point, index, t}
     * @example
     * const point = ruler.pointOnLine(line, [-67.04, 50.5]).point;
     * //=point
     */
    pointOnLine(line: Array<GeometryPoint>, p: GeometryPoint): Object {
        let minDist = Infinity;
        let minX = Infinity, minY = Infinity, minI = Infinity, minT  = Infinity;

        for (let i = 0; i < line.length - 1; i++) {

            let x = line[i][0];
            let y = line[i][1];
            let dx = wrap(line[i + 1][0] - x) * this.kx;
            let dy = (line[i + 1][1] - y) * this.ky;
            let t = 0;

            if (dx !== 0 || dy !== 0) {
                t = (wrap(p[0] - x) * this.kx * dx + (p[1] - y) * this.ky * dy) / (dx * dx + dy * dy);

                if (t > 1) {
                    x = line[i + 1][0];
                    y = line[i + 1][1];

                } else if (t > 0) {
                    x += (dx / this.kx) * t;
                    y += (dy / this.ky) * t;
                }
            }

            dx = wrap(p[0] - x) * this.kx;
            dy = (p[1] - y) * this.ky;

            const sqDist = dx * dx + dy * dy;
            if (sqDist < minDist) {
                minDist = sqDist;
                minX = x;
                minY = y;
                minI = i;
                minT = t;
            }
        }

        return {
            point: [minX, minY],
            index: minI,
            t: Math.max(0, Math.min(1, minT))
        };
    }

}
