import {isValue} from '../values';
import {NumberType} from '../types';
import {classifyRings, updateBBox, boxWithinBox, pointWithinPolygon, segmentIntersectSegment} from '../../util/geometry_util';
import {lngFromMercatorX, latFromMercatorY} from '../../util/mercator';
import TinyQueue from "tinyqueue";
import EXTENT from '../../data/extent';

// Geodesic scale factors (cheap-ruler math): meters per degree lon/lat at a given latitude.
// Only the three distance operations used in this file are implemented.
const RE = 6378.137; // WGS84 equatorial radius (km)
const FE = 1 / 298.257223563; // WGS84 flattening
const E2 = FE * (2 - FE);
const RAD = Math.PI / 180;

function lngLatScale(lat: number): [number, number] {
    const m = RAD * RE * 1000;
    const coslat = Math.cos(lat * RAD);
    const w2 = 1 / (1 - E2 * (1 - coslat * coslat));
    const w = Math.sqrt(w2);
    return [m * w * coslat, m * w * w2 * (1 - E2)]; // [kx, ky]
}

function wrapLng(deg: number): number {
    while (deg < -180) deg += 360;
    while (deg > 180) deg -= 360;
    return deg;
}

function rulerDistance(a: [number, number], b: [number, number], kx: number, ky: number): number {
    const dx = wrapLng(a[0] - b[0]) * kx;
    const dy = (a[1] - b[1]) * ky;
    return Math.sqrt(dx * dx + dy * dy);
}

function rulerPointToSegmentDistance(p: [number, number], a: [number, number], b: [number, number], kx: number, ky: number): number {
    let x = a[0];
    let y = a[1];
    let dx = wrapLng(b[0] - x) * kx;
    let dy = (b[1] - y) * ky;

    if (dx !== 0 || dy !== 0) {
        const t = (wrapLng(p[0] - x) * kx * dx + (p[1] - y) * ky * dy) / (dx * dx + dy * dy);
        if (t > 1) {
            x = b[0];
            y = b[1];
        } else if (t > 0) {
            x += (dx / kx) * t;
            y += (dy / ky) * t;
        }
    }

    dx = wrapLng(p[0] - x) * kx;
    dy = (p[1] - y) * ky;
    return Math.sqrt(dx * dx + dy * dy);
}

function rulerPointOnLine(line: Array<[number, number]>, p: [number, number], kx: number, ky: number): [number, number] {
    let minDist = Infinity;
    let minX = line[0][0];
    let minY = line[0][1];

    for (let i = 0; i < line.length - 1; i++) {
        let x = line[i][0];
        let y = line[i][1];
        let dx = wrapLng(line[i + 1][0] - x) * kx;
        let dy = (line[i + 1][1] - y) * ky;
        let t = 0;

        if (dx !== 0 || dy !== 0) {
            t = (wrapLng(p[0] - x) * kx * dx + (p[1] - y) * ky * dy) / (dx * dx + dy * dy);
            if (t > 1) {
                x = line[i + 1][0];
                y = line[i + 1][1];
            } else if (t > 0) {
                x += (dx / kx) * t;
                y += (dy / ky) * t;
            }
        }

        dx = wrapLng(p[0] - x) * kx;
        dy = (p[1] - y) * ky;
        const sqDist = dx * dx + dy * dy;
        if (sqDist < minDist) {
            minDist = sqDist;
            minX = x;
            minY = y;
        }
    }

    return [minX, minY];
}

import type Point from "@mapbox/point-geometry";
import type ParsingContext from '../parsing_context';
import type {BBox} from '../../util/geometry_util';
import type {Type} from '../types';
import type {Expression} from '../expression';
import type {CanonicalTileID} from '../../types/tile_id';
import type EvaluationContext from '../evaluation_context';

type DistanceGeometry = GeoJSON.Point | GeoJSON.MultiPoint | GeoJSON.LineString | GeoJSON.MultiLineString | GeoJSON.Polygon | GeoJSON.MultiPolygon;

// Inclusive index range for multipoint or linestring container
type IndexRange = [number, number];
type DistPair = {
    dist: number;
    range1: IndexRange;
    range2: IndexRange;
};
function compareMax(a: DistPair, b: DistPair) {
    return b.dist - a.dist;
}

const MIN_POINT_SIZE = 100;
const MIN_LINE_POINT_SIZE = 50;

function isDefaultBBOX(bbox: BBox) {
    const defualtBBox = [Infinity, Infinity, -Infinity, -Infinity];
    if (defualtBBox.length !== bbox.length) {
        return false;
    }
    for (let i = 0; i < defualtBBox.length; i++) {
        if (defualtBBox[i] !== bbox[i]) {
            return false;
        }
    }
    return true;
}

function getRangeSize(range: IndexRange) {
    return range[1] - range[0] + 1;
}

function isRangeSafe(range: IndexRange, threshold: number) {
    const ret = range[1] >= range[0] && range[1] < threshold;
    if (!ret) {
        console.warn("Distance Expression: Index is out of range");
    }
    return ret;
}

// Split the point set(points or linestring) into two halves, using IndexRange to do in-place splitting.
// If geometry is a line, the last point(here is the second index) of range1 needs to be included as the first point(here is the first index) of range2.
// If geometry are points, just split the points equally(if possible) into two new point sets(here are two index ranges).
function splitRange(range: IndexRange, isLine: boolean) {
    if (range[0] > range[1]) return [null, null];
    const size = getRangeSize(range);
    if (isLine) {
        if (size === 2) {
            return [range, null];
        }
        const size1 = Math.floor(size / 2);
        const range1: IndexRange = [range[0], range[0] + size1];
        const range2: IndexRange = [range[0] + size1, range[1]];
        return [range1, range2];
    } else {
        if (size === 1) {
            return [range, null];
        }
        const size1 = Math.floor(size / 2) - 1;
        const range1: IndexRange = [range[0], range[0] + size1];
        const range2: IndexRange = [range[0] + size1 + 1, range[1]];
        return [range1, range2];
    }
}

function getBBox(pointSets: Array<[number, number]>, range: IndexRange) {
    const bbox: BBox = [Infinity, Infinity, -Infinity, -Infinity];
    if (!isRangeSafe(range, pointSets.length)) return bbox;
    for (let i = range[0]; i <= range[1]; ++i) {
        updateBBox(bbox, pointSets[i]);
    }
    return bbox;
}

function getPolygonBBox(polygon: Array<Array<[number, number]>>) {
    const bbox: BBox = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < polygon.length; ++i) {
        for (let j = 0; j < polygon[i].length; ++j) {
            updateBBox(bbox, polygon[i][j]);
        }
    }
    return bbox;
}

// Calculate the distance between two bounding boxes.
// Calculate the delta in x and y direction, and use two fake points {0.0, 0.0} and {dx, dy} to calculate the distance.
// Distance will be 0.0 if bounding box are overlapping.
function bboxToBBoxDistance(bbox1: BBox, bbox2: BBox, kx: number, ky: number) {
    if (isDefaultBBOX(bbox1) || isDefaultBBOX(bbox2)) {
        return NaN;
    }
    let dx = 0.0;
    let dy = 0.0;
    // bbox1 in left side
    if (bbox1[2] < bbox2[0]) {
        dx = bbox2[0] - bbox1[2];
    }
    // bbox1 in right side
    if (bbox1[0] > bbox2[2]) {
        dx = bbox1[0] - bbox2[2];
    }
    // bbox1 in above side
    if (bbox1[1] > bbox2[3]) {
        dy = bbox1[1] - bbox2[3];
    }
    // bbox1 in down side
    if (bbox1[3] < bbox2[1]) {
        dy = bbox2[1] - bbox1[3];
    }
    return rulerDistance([0.0, 0.0], [dx, dy], kx, ky);
}

export function getLngLatPoint(coord: Point, canonical: CanonicalTileID, extent: number = EXTENT): [number, number] {
    const tilesAtZoom = Math.pow(2, canonical.z);
    const x = (coord.x / extent + canonical.x) / tilesAtZoom;
    const y = (coord.y / extent + canonical.y) / tilesAtZoom;
    return [lngFromMercatorX(x), latFromMercatorY(y)];
}

function getLngLatPoints(coordinates: Array<Point>, canonical: CanonicalTileID): Array<[number, number]> {
    const coords: Array<[number, number]> = [];
    for (let i = 0; i < coordinates.length; ++i) {
        coords.push(getLngLatPoint(coordinates[i], canonical));
    }
    return coords;
}

function pointToLineDistance(point: [number, number], line: Array<[number, number]>, kx: number, ky: number) {
    const nearestPoint = rulerPointOnLine(line, point, kx, ky);
    return rulerDistance(point, nearestPoint, kx, ky);
}

function pointsToLineDistance(points: Array<[number, number]>, rangeA: IndexRange, line: Array<[number, number]>, rangeB: IndexRange, kx: number, ky: number) {
    const subLine = line.slice(rangeB[0], rangeB[1] + 1);
    let dist = Infinity;
    for (let i = rangeA[0]; i <= rangeA[1]; ++i) {
        if ((dist = Math.min(dist, pointToLineDistance(points[i], subLine, kx, ky))) === 0.0) return 0.0;
    }
    return dist;
}

// precondition is two segments are not intersecting with each other
function segmentToSegmentDistance(p1: [number, number], p2: [number, number], q1: [number, number], q2: [number, number], kx: number, ky: number) {
    const dist1 = Math.min(
        rulerPointToSegmentDistance(p1, q1, q2, kx, ky),
        rulerPointToSegmentDistance(p2, q1, q2, kx, ky)
    );
    const dist2 = Math.min(
        rulerPointToSegmentDistance(q1, p1, p2, kx, ky),
        rulerPointToSegmentDistance(q2, p1, p2, kx, ky)
    );

    return Math.min(dist1, dist2);
}

function lineToLineDistance(line1: Array<[number, number]>, range1: IndexRange, line2: Array<[number, number]>, range2: IndexRange, kx: number, ky: number) {
    if (!isRangeSafe(range1, line1.length) || !isRangeSafe(range2, line2.length)) {
        return NaN;
    }
    let dist = Infinity;
    for (let i = range1[0]; i < range1[1]; ++i) {
        for (let j = range2[0]; j < range2[1]; ++j) {
            if (segmentIntersectSegment(line1[i], line1[i + 1], line2[j], line2[j + 1])) return 0.0;
            dist = Math.min(dist, segmentToSegmentDistance(line1[i], line1[i + 1], line2[j], line2[j + 1], kx, ky));
        }
    }
    return dist;
}

function pointsToPointsDistance(pointSet1: Array<[number, number]>, range1: IndexRange, pointSet2: Array<[number, number]>, range2: IndexRange, kx: number, ky: number) {
    if (!isRangeSafe(range1, pointSet1.length) || !isRangeSafe(range2, pointSet2.length)) {
        return NaN;
    }
    let dist = Infinity;
    for (let i = range1[0]; i <= range1[1]; ++i) {
        for (let j = range2[0]; j <= range2[1]; ++j) {
            if ((dist = Math.min(dist, rulerDistance(pointSet1[i], pointSet2[j], kx, ky))) === 0.0) return dist;
        }
    }
    return dist;
}

function pointToPolygonDistance(point: [number, number], polygon: Array<Array<[number, number]>>, kx: number, ky: number) {
    if (pointWithinPolygon(point, polygon, true /*trueOnBoundary*/)) return 0.0;
    let dist = Infinity;
    for (const ring of polygon) {
        const ringLen = ring.length;
        if (ringLen < 2) {
            console.warn("Distance Expression: Invalid polygon!");
            return NaN;
        }
        if (ring[0] !== ring[ringLen - 1]) {
            if ((dist = Math.min(dist, rulerPointToSegmentDistance(point, ring[ringLen - 1], ring[0], kx, ky))) === 0.0) return dist;
        }
        if ((dist = Math.min(dist, pointToLineDistance(point, ring, kx, ky))) === 0.0) return dist;
    }
    return dist;
}

function lineToPolygonDistance(line: Array<[number, number]>, range: IndexRange, polygon: Array<Array<[number, number]>>, kx: number, ky: number) {
    if (!isRangeSafe(range, line.length)) {
        return NaN;
    }
    for (let i = range[0]; i <= range[1]; ++i) {
        if (pointWithinPolygon(line[i], polygon, true /*trueOnBoundary*/)) return 0.0;
    }
    let dist = Infinity;
    for (let i = range[0]; i < range[1]; ++i) {
        for (const ring of polygon) {
            for (let j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
                if (segmentIntersectSegment(line[i], line[i + 1], ring[k], ring[j])) return 0.0;
                dist = Math.min(dist, segmentToSegmentDistance(line[i], line[i + 1], ring[k], ring[j], kx, ky));
            }
        }
    }
    return dist;
}

function polygonIntersect(polygon1: Array<Array<[number, number]>>, polygon2: Array<Array<[number, number]>>) {
    for (const ring of polygon1) {
        for (let i = 0; i <= ring.length - 1; ++i) {
            if (pointWithinPolygon(ring[i], polygon2, true /*trueOnBoundary*/)) return true;
        }
    }
    return false;
}

function polygonToPolygonDistance(polygon1: Array<Array<[number, number]>>, polygon2: Array<Array<[number, number]>>, kx: number, ky: number, currentMiniDist: number = Infinity) {
    const bbox1 = getPolygonBBox(polygon1);
    const bbox2 = getPolygonBBox(polygon2);
    if (currentMiniDist !== Infinity && bboxToBBoxDistance(bbox1, bbox2, kx, ky) >= currentMiniDist) {
        return currentMiniDist;
    }
    if (boxWithinBox(bbox1, bbox2)) {
        if (polygonIntersect(polygon1, polygon2)) return 0.0;
    } else if (polygonIntersect(polygon2, polygon1)) {
        return 0.0;
    }
    let dist = currentMiniDist;
    for (const ring1 of polygon1) {
        for (let i = 0, len1 = ring1.length, l = len1 - 1; i < len1; l = i++) {
            for (const ring2 of polygon2) {
                for (let j = 0, len2 = ring2.length, k = len2 - 1; j < len2; k = j++) {
                    if (segmentIntersectSegment(ring1[l], ring1[i], ring2[k], ring2[j])) return 0.0;
                    dist = Math.min(dist, segmentToSegmentDistance(ring1[l], ring1[i], ring2[k], ring2[j], kx, ky));
                }
            }
        }
    }
    return dist;
}

function updateQueue(distQueue: TinyQueue<DistPair>, miniDist: number, kx: number, ky: number, pointSet1: Array<[number, number]>, pointSet2: Array<[number, number]>, r1: IndexRange | null, r2: IndexRange | null) {
    if (r1 === null || r2 === null) return;
    const tempDist = bboxToBBoxDistance(getBBox(pointSet1, r1), getBBox(pointSet2, r2), kx, ky);
    // Insert new pair to the queue if the bbox distance is less than miniDist, the pair with biggest distance will be at the top
    if (tempDist < miniDist) distQueue.push({dist: tempDist, range1: r1, range2: r2});
}

// Divide and conquer, the time complexity is O(n*lgn), faster than Brute force O(n*n)
// Most of the time, use index for in-place processing.
function pointSetToPolygonDistance(pointSets: Array<[number, number]>, isLine: boolean, polygon: Array<Array<[number, number]>>, kx: number, ky: number, currentMiniDist: number = Infinity) {
    let miniDist = Math.min(rulerDistance(pointSets[0], polygon[0][0], kx, ky), currentMiniDist);
    if (miniDist === 0.0) return miniDist;
    const initialDistPair: DistPair = {
        dist: 0,
        range1: [0, pointSets.length - 1],
        range2: [0, 0]
    };
    const distQueue = new TinyQueue<DistPair>([initialDistPair], compareMax);

    const setThreshold = isLine ? MIN_LINE_POINT_SIZE : MIN_POINT_SIZE;
    const polyBBox = getPolygonBBox(polygon);

    while (distQueue.length) {
        const distPair = distQueue.pop();
        if (distPair.dist >= miniDist) continue;
        const range = distPair.range1;
        // In case the set size are relatively small, we could use brute-force directly
        if (getRangeSize(range) <= setThreshold) {
            if (!isRangeSafe(range, pointSets.length)) return NaN;
            if (isLine) {
                const tempDist = lineToPolygonDistance(pointSets, range, polygon, kx, ky);
                if ((miniDist = Math.min(miniDist, tempDist)) === 0.0) return miniDist;
            } else {
                for (let i = range[0]; i <= range[1]; ++i) {
                    const tempDist = pointToPolygonDistance(pointSets[i], polygon, kx, ky);
                    if ((miniDist = Math.min(miniDist, tempDist)) === 0.0) return miniDist;
                }
            }
        } else {
            const newRanges = splitRange(range, isLine);
            if (newRanges[0] !== null) {
                const tempDist = bboxToBBoxDistance(getBBox(pointSets, newRanges[0]), polyBBox, kx, ky);
                if (tempDist < miniDist) distQueue.push({dist: tempDist, range1: newRanges[0], range2: [0, 0]});
            }
            if (newRanges[1] !== null) {
                const tempDist = bboxToBBoxDistance(getBBox(pointSets, newRanges[1]), polyBBox, kx, ky);
                if (tempDist < miniDist) distQueue.push({dist: tempDist, range1: newRanges[1], range2: [0, 0]});
            }
        }
    }
    return miniDist;
}

function pointSetsDistance(pointSet1: Array<[number, number]>, isLine1: boolean, pointSet2: Array<[number, number]>, isLine2: boolean, kx: number, ky: number, currentMiniDist: number = Infinity) {
    let miniDist = Math.min(currentMiniDist, rulerDistance(pointSet1[0], pointSet2[0], kx, ky));
    if (miniDist === 0.0) return miniDist;
    const initialDistPair: DistPair = {
        dist: 0,
        range1: [0, pointSet1.length - 1],
        range2: [0, pointSet2.length - 1]
    };
    const distQueue = new TinyQueue<DistPair>([initialDistPair], compareMax);

    const set1Threshold = isLine1 ? MIN_LINE_POINT_SIZE : MIN_POINT_SIZE;
    const set2Threshold = isLine2 ? MIN_LINE_POINT_SIZE : MIN_POINT_SIZE;

    while (distQueue.length) {
        const distPair = distQueue.pop();
        if (distPair.dist >= miniDist) continue;
        const rangeA = distPair.range1;
        const rangeB = distPair.range2;
        // In case the set size are relatively small, we could use brute-force directly
        if (getRangeSize(rangeA) <= set1Threshold && getRangeSize(rangeB) <= set2Threshold) {
            if (!isRangeSafe(rangeA, pointSet1.length) || !isRangeSafe(rangeB, pointSet2.length)) {
                return NaN;
            }
            if (isLine1 && isLine2) {
                miniDist = Math.min(miniDist, lineToLineDistance(pointSet1, rangeA, pointSet2, rangeB, kx, ky));
            } else if (!isLine1 && !isLine2) {
                miniDist = Math.min(miniDist, pointsToPointsDistance(pointSet1, rangeA, pointSet2, rangeB, kx, ky));
            } else if (isLine1 && !isLine2) {
                miniDist = Math.min(miniDist, pointsToLineDistance(pointSet2, rangeB, pointSet1, rangeA, kx, ky));
            } else if (!isLine1 && isLine2) {
                miniDist = Math.min(miniDist, pointsToLineDistance(pointSet1, rangeA, pointSet2, rangeB, kx, ky));
            }
            if (miniDist === 0.0) return miniDist;
        } else {
            const newRangesA = splitRange(rangeA, isLine1);
            const newRangesB = splitRange(rangeB, isLine2);
            updateQueue(distQueue, miniDist, kx, ky, pointSet1, pointSet2, newRangesA[0], newRangesB[0]);
            updateQueue(distQueue, miniDist, kx, ky, pointSet1, pointSet2, newRangesA[0], newRangesB[1]);
            updateQueue(distQueue, miniDist, kx, ky, pointSet1, pointSet2, newRangesA[1], newRangesB[0]);
            updateQueue(distQueue, miniDist, kx, ky, pointSet1, pointSet2, newRangesA[1], newRangesB[1]);
        }
    }
    return miniDist;
}

function pointSetToLinesDistance(pointSet: Array<[number, number]>, isLine: boolean, lines: Array<Array<[number, number]>>, kx: number, ky: number, currentMiniDist: number = Infinity) {
    let dist = currentMiniDist;
    const bbox1 = getBBox(pointSet, [0, pointSet.length - 1]);
    for (const line of lines) {
        if (dist !== Infinity && bboxToBBoxDistance(bbox1, getBBox(line, [0, line.length - 1]), kx, ky) >= dist) continue;
        dist = Math.min(dist, pointSetsDistance(pointSet, isLine, line, true /*isLine*/, kx, ky, dist));
        if (dist === 0.0) return dist;
    }
    return dist;
}

function pointSetToPolygonsDistance(points: Array<[number, number]>, isLine: boolean, polygons: Array<Array<Array<[number, number]>>>, kx: number, ky: number, currentMiniDist: number = Infinity) {
    let dist = currentMiniDist;
    const bbox1 = getBBox(points, [0, points.length - 1]);
    for (const polygon of polygons) {
        if (dist !== Infinity && bboxToBBoxDistance(bbox1, getPolygonBBox(polygon), kx, ky) >= dist) continue;
        const tempDist = pointSetToPolygonDistance(points, isLine, polygon, kx, ky, dist);
        if (isNaN(tempDist)) return tempDist;
        if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
    }
    return dist;
}

function polygonsToPolygonsDistance(polygons1: Array<Array<Array<[number, number]>>>, polygons2: Array<Array<Array<[number, number]>>>, kx: number, ky: number) {
    let dist = Infinity;
    for (const polygon1 of polygons1) {
        for (const polygon2 of polygons2) {
            const tempDist = polygonToPolygonDistance(polygon1, polygon2, kx, ky, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
    }
    return dist;
}

function pointsToGeometryDistance(originGeometry: Array<Array<Point>>, canonical: CanonicalTileID, geometry: DistanceGeometry) {
    const lngLatPoints: Array<[number, number]> = [];
    for (const points of originGeometry) {
        for (const point of points) {
            lngLatPoints.push(getLngLatPoint(point, canonical));
        }
    }
    const [kx, ky] = lngLatScale(lngLatPoints[0][1]);
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
        return pointSetsDistance(lngLatPoints, false /*isLine*/,
            (geometry.type === 'Point' ? [geometry.coordinates] : geometry.coordinates) as Array<[number, number]>,
            geometry.type === 'LineString' /*isLine*/, kx, ky);
    }
    if (geometry.type === 'MultiLineString') {
        return pointSetToLinesDistance(lngLatPoints, false /*isLine*/, geometry.coordinates as Array<Array<[number, number]>>, kx, ky);
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        return pointSetToPolygonsDistance(lngLatPoints, false /*isLine*/,
            (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Array<Array<Array<[number, number]>>>, kx, ky);
    }
    return null;
}

function linesToGeometryDistance(originGeometry: Array<Array<Point>>, canonical: CanonicalTileID, geometry: DistanceGeometry) {
    const lngLatLines: Array<Array<[number, number]>> = [];
    for (const line of originGeometry) {
        const lngLatLine: Array<[number, number]> = [];
        for (const point of line) {
            lngLatLine.push(getLngLatPoint(point, canonical));
        }
        lngLatLines.push(lngLatLine);
    }
    const [kx, ky] = lngLatScale(lngLatLines[0][0][1]);
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
        return pointSetToLinesDistance(
            (geometry.type === 'Point' ? [geometry.coordinates] : geometry.coordinates) as Array<[number, number]>,
            geometry.type === 'LineString' /*isLine*/, lngLatLines, kx, ky);
    }
    if (geometry.type === 'MultiLineString') {
        let dist = Infinity;
        for (let i = 0; i < geometry.coordinates.length; i++) {
            const tempDist = pointSetToLinesDistance(geometry.coordinates[i] as Array<[number, number]>, true /*isLine*/, lngLatLines, kx, ky, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
        return dist;
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        let dist = Infinity;
        for (let i = 0; i < lngLatLines.length; i++) {
            const tempDist = pointSetToPolygonsDistance(lngLatLines[i], true /*isLine*/,
                (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Array<Array<Array<[number, number]>>>,
                kx, ky, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
        return dist;
    }
    return null;
}

function polygonsToGeometryDistance(originGeometry: Array<Array<Point>>, canonical: CanonicalTileID, geometry: DistanceGeometry) {
    const lngLatPolygons: Array<Array<Array<[number, number]>>> = [];
    for (const polygon of classifyRings(originGeometry, 0)) {
        const lngLatPolygon: Array<Array<[number, number]>> = [];
        for (let i = 0; i < polygon.length; ++i) {
            lngLatPolygon.push(getLngLatPoints(polygon[i], canonical));
        }
        lngLatPolygons.push(lngLatPolygon);
    }
    const [kx, ky] = lngLatScale(lngLatPolygons[0][0][0][1]);
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
        return pointSetToPolygonsDistance(
            (geometry.type === 'Point' ? [geometry.coordinates] : geometry.coordinates) as Array<[number, number]>,
            geometry.type === 'LineString' /*isLine*/, lngLatPolygons, kx, ky);
    }
    if (geometry.type === 'MultiLineString') {
        let dist = Infinity;
        for (let i = 0; i < geometry.coordinates.length; i++) {
            const tempDist = pointSetToPolygonsDistance(geometry.coordinates[i] as Array<[number, number]>, true /*isLine*/, lngLatPolygons, kx, ky, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
        return dist;
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        return polygonsToPolygonsDistance(
            (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates) as Array<Array<Array<[number, number]>>>,
            lngLatPolygons, kx, ky);
    }
    return null;
}

function isTypeValid(type: string) {
    return (
        type === "Point" ||
        type === "MultiPoint" ||
        type === "LineString" ||
        type === "MultiLineString" ||
        type === "Polygon" ||
        type === "MultiPolygon"
    );
}
class Distance implements Expression {
    type: Type;
    geojson: GeoJSON.GeoJSON;
    geometries: DistanceGeometry;

    constructor(geojson: GeoJSON.GeoJSON, geometries: DistanceGeometry) {
        this.type = NumberType;
        this.geojson = geojson;
        this.geometries = geometries;
    }

    static parse(args: ReadonlyArray<unknown>, context: ParsingContext): Distance | null | void {
        if (args.length !== 2) {
            return context.error(`'distance' expression requires either one argument, but found ' ${args.length - 1} instead.`);
        }
        if (isValue(args[1])) {
            const geojson = args[1] as GeoJSON.GeoJSON;
            if (geojson.type === 'FeatureCollection') {
                for (let i = 0; i < geojson.features.length; ++i) {
                    if (isTypeValid(geojson.features[i].geometry.type)) {
                        return new Distance(geojson, geojson.features[i].geometry as DistanceGeometry);
                    }
                }
            } else if (geojson.type === 'Feature') {
                if (isTypeValid(geojson.geometry.type)) {
                    return new Distance(geojson, geojson.geometry as DistanceGeometry);
                }
            } else if (isTypeValid(geojson.type)) {
                return new Distance(geojson, geojson as DistanceGeometry);
            }
        }
        return context.error(
            "'distance' expression needs to be an array with format [\'Distance\', GeoJSONObj]."
        );
    }

    evaluate(ctx: EvaluationContext): number | null {
        const geometry = ctx.geometry();
        const canonical = ctx.canonicalID();
        if (geometry != null && canonical != null) {
            if (ctx.geometryType() === 'Point') {
                return pointsToGeometryDistance(geometry, canonical, this.geometries);
            }
            if (ctx.geometryType() === 'LineString') {
                return linesToGeometryDistance(geometry, canonical, this.geometries);
            }
            if (ctx.geometryType() === 'Polygon') {
                return polygonsToGeometryDistance(geometry, canonical, this.geometries);
            }
            console.warn("Distance Expression: currently only evaluates valid Point/LineString/Polygon geometries.");
        } else {
            console.warn("Distance Expression: requires valid feature and canonical information.");
        }
        return null;
    }

    eachChild() {}

    outputDefined(): boolean {
        return true;
    }

    serialize(): Array<unknown> {
        return ['distance', this.geojson];
    }
}

export default Distance;
