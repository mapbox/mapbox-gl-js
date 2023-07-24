// @flow
import type Point from '@mapbox/point-geometry';
import quickselect from 'quickselect';

type GeoJSONPosition = [number, number] | [number, number, number];

// minX, minY, maxX, maxY
export type BBox = [number, number, number, number];

/**
 * Returns the signed area for the polygon ring.  Postive areas are exterior rings and
 * have a clockwise winding.  Negative areas are interior rings and have a counter clockwise
 * ordering.
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

function compareAreas(a: {area: number}, b: {area: number}) {
    return b.area - a.area;
}

// classifies an array of rings into polygons with outer rings and holes
export function classifyRings(rings: Array<Array<Point>>, maxRings: number): Array<Array<Array<Point>>> {
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

export function updateBBox(bbox: BBox, coord: GeoJSONPosition) {
    bbox[0] = Math.min(bbox[0], coord[0]);
    bbox[1] = Math.min(bbox[1], coord[1]);
    bbox[2] = Math.max(bbox[2], coord[0]);
    bbox[3] = Math.max(bbox[3], coord[1]);
}

export function boxWithinBox(bbox1: BBox, bbox2: BBox): boolean {
    if (bbox1[0] <= bbox2[0]) return false;
    if (bbox1[2] >= bbox2[2]) return false;
    if (bbox1[1] <= bbox2[1]) return false;
    if (bbox1[3] >= bbox2[3]) return false;
    return true;
}

function onBoundary(p: GeoJSONPosition, p1: GeoJSONPosition, p2: GeoJSONPosition) {
    const x1 = p[0] - p1[0];
    const y1 = p[1] - p1[1];
    const x2 = p[0] - p2[0];
    const y2 = p[1] - p2[1];
    return (x1 * y2 - x2 * y1 === 0) && (x1 * x2 <= 0) && (y1 * y2 <= 0);
}

function rayIntersect(p: GeoJSONPosition, p1: GeoJSONPosition, p2: GeoJSONPosition) {
    return ((p1[1] > p[1]) !== (p2[1] > p[1])) && (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0]);
}

// ray casting algorithm for detecting if point is in polygon
export function pointWithinPolygon(point: GeoJSONPosition, rings: Array<Array<GeoJSONPosition>>, trueOnBoundary: boolean = false): boolean {
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

function perp(v1: GeoJSONPosition, v2: GeoJSONPosition) {
    return v1[0] * v2[1] - v1[1] * v2[0];
}

// check if p1 and p2 are in different sides of line segment q1->q2
function twoSided(p1: GeoJSONPosition, p2: GeoJSONPosition, q1: GeoJSONPosition, q2: GeoJSONPosition) {
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
export function segmentIntersectSegment(a: GeoJSONPosition, b: GeoJSONPosition, c: GeoJSONPosition, d: GeoJSONPosition): boolean {
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

