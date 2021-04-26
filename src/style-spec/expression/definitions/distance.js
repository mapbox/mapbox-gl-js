// @flow

import {isValue} from "../values.js";
import type {Type} from "../types.js";
import {NumberType} from "../types.js";
import type {Expression} from "../expression.js";
import type ParsingContext from "../parsing_context.js";
import type EvaluationContext from "../evaluation_context.js";
import type {
    GeoJSON,
    GeoJSONPoint,
    GeoJSONMultiPoint,
    GeoJSONLineString,
    GeoJSONMultiLineString,
    GeoJSONPolygon,
    GeoJSONMultiPolygon
} from "@mapbox/geojson-types";
import {classifyRings, updateBBox, boxWithinBox, pointWithinPolygon, segmentIntersectSegment} from '../../util/geometry_util.js';
import CheapRuler from "cheap-ruler";
import type {GeometryPoint} from "cheap-ruler";
import Point from "@mapbox/point-geometry";
import Queue from "tinyqueue";

type DistanceGeometry =
    | GeoJSONPoint
    | GeoJSONMultiPoint
    | GeoJSONLineString
    | GeoJSONMultiLineString
    | GeoJSONPolygon
    | GeoJSONMultiPolygon;

// Inclusive index range for multipoint or linestring container
type IndexRange = [number, number];
type DistPair = { dist: number, range1: IndexRange, range2: IndexRange };

const EXTENT = 8192;
const MIN_POINT_SIZE = 100;
const MIN_LINE_POINT_SIZE = 50;

function getRangeSize(range: IndexRange) {
    return range[1] - range[0] + 1;
}

function isRangeSafe(range: IndexRange, threshold: number) {
    return range[1] >= range[0] && range[1] < threshold;
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

function getBBox(pointSets: Array<GeometryPoint>, range: IndexRange) {
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    if (!isRangeSafe(range, pointSets.length)) return bbox;
    for (let i = range[0]; i <= range[1]; ++i) {
        updateBBox(bbox, pointSets[i]);
    }
    return bbox;
}

function getPolygonBBox(polygon: Array<Array<GeometryPoint>>) {
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
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
function bboxToBBoxDistance(bbox1, bbox2, ruler) {
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
    return ruler.distance([0.0, 0.0], [dx, dy]);
}

function lngFromMercatorX(x: number) {
    return x * 360 - 180;
}

function latFromMercatorY(y: number) {
    const y2 = 180 - y * 360;
    return (360 / Math.PI) * Math.atan(Math.exp((y2 * Math.PI) / 180)) - 90;
}

function getLngLatPoint(coord: Point, canonical) {
    const tilesAtZoom = Math.pow(2, canonical.z);
    const x = (coord.x / EXTENT + canonical.x) / tilesAtZoom;
    const y = (coord.y / EXTENT + canonical.y) / tilesAtZoom;
    return [lngFromMercatorX(x), latFromMercatorY(y)];
}

function getLngLatPoints(coordinates, canonical) {
    const coords = [];
    for (let i = 0; i < coordinates.length; ++i) {
        coords.push(getLngLatPoint(coordinates[i], canonical));
    }
    return coords;
}

function pointToLineDistance(point, line, ruler) {
    const nearestPoint = ruler.pointOnLine(line, point).point;
    return ruler.distance(point, nearestPoint);
}

function pointsToLineDistance(points, rangeA, line, rangeB, ruler) {
    const subLine = line.slice(rangeB[0], rangeB[1] + 1);
    let dist = Infinity;
    for (let i = rangeA[0]; i <= rangeA[1]; ++i) {
        if ((dist = Math.min(dist, pointToLineDistance(points[i], subLine, ruler))) === 0.0) return 0.0;
    }
    return dist;
}

// precondition is two segments are not intersecting with each other
function segmentToSegmentDistance(p1, p2, q1, q2, ruler) {
    const dist1 = Math.min(
        ruler.pointToSegmentDistance(p1, q1, q2),
        ruler.pointToSegmentDistance(p2, q1, q2)
    );
    const dist2 = Math.min(
        ruler.pointToSegmentDistance(q1, p1, p2),
        ruler.pointToSegmentDistance(q2, p1, p2)
    );

    return Math.min(dist1, dist2);
}

function lineToLineDistance(line1, range1, line2, range2, ruler) {
    let dist = Infinity;
    for (let i = range1[0]; i < range1[1]; ++i) {
        for (let j = range2[0]; j < range2[1]; ++j) {
            if (segmentIntersectSegment(line1[i], line1[i + 1], line2[j], line2[j + 1])) return 0.0;
            dist = Math.min(dist, segmentToSegmentDistance(line1[i], line1[i + 1], line2[j], line2[j + 1], ruler));
        }
    }
    return dist;
}

function pointsToPointsDistance(pointSet1, range1, pointSet2, range2, ruler) {
    let dist = Infinity;
    for (let i = range1[0]; i <= range1[1]; ++i) {
        for (let j = range2[0]; j <= range2[1]; ++j) {
            if ((dist = Math.min(dist, ruler.distance(pointSet1[i], pointSet2[j]))) === 0.0) return dist;
        }
    }
    return dist;
}

function pointToPolygonDistance(point, polygon, ruler) {
    if (pointWithinPolygon(point, polygon, true /*trueOnBoundary*/)) return 0.0;
    let dist = Infinity;
    for (const ring of polygon) {
        if ((dist = Math.min(dist, pointToLineDistance(point, ring, ruler))) === 0.0) return dist;
    }
    return dist;
}

function lineToPolygonDistance(line, range, polygon, ruler) {
    for (let i = range[0]; i <= range[1]; ++i) {
        if (pointWithinPolygon(line[i], polygon, true /*trueOnBoundary*/)) return 0.0;
    }
    let dist = Infinity;
    for (let i = range[0]; i < range[1]; ++i) {
        for (const ring of polygon) {
            for (let j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
                if (segmentIntersectSegment(line[i], line[i + 1], ring[k], ring[j])) return 0.0;
                dist = Math.min(dist, segmentToSegmentDistance(line[i], line[i + 1], ring[k], ring[j], ruler));
            }
        }
    }
    return dist;
}

function polygonIntersect(polygon1, polygon2) {
    for (const ring of polygon1) {
        for (let i = 0; i <= ring.length - 1; ++i) {
            if (pointWithinPolygon(ring[i], polygon2, true /*trueOnBoundary*/)) return true;
        }
    }
    return false;
}

function polygonToPolygonDistance(polygon1, polygon2, ruler, currentMiniDist = Infinity) {
    const bbox1 = getPolygonBBox(polygon1);
    const bbox2 = getPolygonBBox(polygon2);
    if (currentMiniDist !== Infinity && bboxToBBoxDistance(bbox1, bbox2, ruler) >= currentMiniDist) {
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
                    dist = Math.min(dist, segmentToSegmentDistance(ring1[l], ring1[i], ring2[k], ring2[j], ruler));
                }
            }
        }
    }
    return dist;
}

function updateQueue(distQueue, miniDist, ruler, pointSet1, pointSet2, r1, r2) {
    if (r1 === null || r2 === null) return;
    const tempDist = bboxToBBoxDistance(getBBox(pointSet1, r1), getBBox(pointSet2, r2), ruler);
    // Insert new pair to the queue if the bbox distance is less than miniDist, the pair with biggest distance will be at the top
    if (tempDist < miniDist) distQueue.push({dist: tempDist, range1: r1, range2: r2});
}

function compareMax(a, b) {
    return b.dist - a.dist;
}

// Divide and conquer, the time complexity is O(n*lgn), faster than Brute force O(n*n)
// Most of the time, use index for in-place processing.
function pointSetToPolygonDistance(pointSets, isLine, polygon, ruler, currentMiniDist = Infinity) {
    let miniDist = Math.min(ruler.distance(pointSets[0], polygon[0][0]), currentMiniDist);
    if (miniDist === 0.0) return miniDist;
    const initialDistPair: DistPair = {
        dist: 0,
        range1: [0, pointSets.length - 1],
        range2: [0, 0]
    };
    const distQueue = new Queue([initialDistPair], compareMax);

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
                const tempDist = lineToPolygonDistance(pointSets, range, polygon, ruler);
                if ((miniDist = Math.min(miniDist, tempDist)) === 0.0) return miniDist;
            } else {
                for (let i = range[0]; i <= range[1]; ++i) {
                    const tempDist = pointToPolygonDistance(pointSets[i], polygon, ruler);
                    if ((miniDist = Math.min(miniDist, tempDist)) === 0.0) return miniDist;
                }
            }
        } else {
            const newRanges = splitRange(range, isLine);
            if (newRanges[0] !== null) {
                const tempDist = bboxToBBoxDistance(getBBox(pointSets, newRanges[0]), polyBBox, ruler);
                if (tempDist < miniDist) distQueue.push({dist: tempDist, range1: newRanges[0], range2: [0, 0]});
            }
            if (newRanges[1] !== null) {
                const tempDist = bboxToBBoxDistance(getBBox(pointSets, newRanges[1]), polyBBox, ruler);
                if (tempDist < miniDist) distQueue.push({dist: tempDist, range1: newRanges[1], range2: [0, 0]});
            }
        }
    }
    return miniDist;
}

function pointSetsDistance(pointSet1: Array<GeometryPoint>, isLine1: boolean, pointSet2: Array<GeometryPoint>, isLine2: boolean, ruler, currentMiniDist = Infinity) {
    let miniDist = Math.min(currentMiniDist, ruler.distance(pointSet1[0], pointSet2[0]));
    if (miniDist === 0.0) return miniDist;
    const initialDistPair: DistPair = {
        dist: 0,
        range1: [0, pointSet1.length - 1],
        range2: [0, pointSet2.length - 1]
    };
    const distQueue = new Queue([initialDistPair], compareMax);

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
                miniDist = Math.min(miniDist, lineToLineDistance(pointSet1, rangeA, pointSet2, rangeB, ruler));
            } else if (!isLine1 && !isLine2) {
                miniDist = Math.min(miniDist, pointsToPointsDistance(pointSet1, rangeA, pointSet2, rangeB, ruler));
            } else if (isLine1 && !isLine2) {
                miniDist = Math.min(miniDist, pointsToLineDistance(pointSet2, rangeB, pointSet1, rangeA, ruler));
            } else if (!isLine1 && isLine2) {
                miniDist = Math.min(miniDist, pointsToLineDistance(pointSet1, rangeA, pointSet2, rangeB, ruler));
            }
            if (miniDist === 0.0) return miniDist;
        } else {
            const newRangesA = splitRange(rangeA, isLine1);
            const newRangesB = splitRange(rangeB, isLine2);
            updateQueue(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[0], newRangesB[0]);
            updateQueue(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[0], newRangesB[1]);
            updateQueue(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[1], newRangesB[0]);
            updateQueue(distQueue, miniDist, ruler, pointSet1, pointSet2, newRangesA[1], newRangesB[1]);
        }
    }
    return miniDist;
}

function pointSetToLinesDistance(pointSet, isLine, lines, ruler, currentMiniDist = Infinity) {
    let dist = currentMiniDist;
    const bbox1 = getBBox(pointSet, [0, pointSet.length - 1]);
    for (const line of lines) {
        if (dist !== Infinity && bboxToBBoxDistance(bbox1, getBBox(line, [0, line.length - 1]), ruler) >= dist) continue;
        dist = Math.min(dist, pointSetsDistance(pointSet, isLine, line, true /*isLine*/, ruler, dist));
        if (dist === 0.0) return dist;
    }
    return dist;
}

function pointSetToPolygonsDistance(points, isLine, polygons, ruler, currentMiniDist = Infinity) {
    let dist = currentMiniDist;
    const bbox1 = getBBox(points, [0, points.length - 1]);
    for (const polygon of polygons) {
        if (dist !== Infinity && bboxToBBoxDistance(bbox1, getPolygonBBox(polygon), ruler) >= dist) continue;
        const tempDist = pointSetToPolygonDistance(points, isLine, polygon, ruler, dist);
        if (isNaN(tempDist)) return tempDist;
        if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
    }
    return dist;
}

function polygonsToPolygonsDistance(polygons1, polygons2, ruler) {
    let dist = Infinity;
    for (const polygon1 of polygons1) {
        for (const polygon2 of polygons2) {
            const tempDist = polygonToPolygonDistance(polygon1, polygon2, ruler, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
    }
    return dist;
}

function pointsToGeometryDistance(ctx: EvaluationContext, geometry: DistanceGeometry) {
    const lngLatPoints = [];
    for (const points of ctx.geometry()) {
        for (const point of points) {
            lngLatPoints.push(getLngLatPoint(point, ctx.canonicalID()));
        }
    }
    const ruler = new CheapRuler(lngLatPoints[0][1], 'meters');
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
        return pointSetsDistance(lngLatPoints, false /*isLine*/,
            geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates,
            geometry.type === 'LineString' /*isLine*/, ruler);
    }
    if (geometry.type === 'MultiLineString') {
        return pointSetToLinesDistance(lngLatPoints, false /*isLine*/,  geometry.coordinates, ruler);
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        return pointSetToPolygonsDistance(lngLatPoints, false /*isLine*/,
            geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates, ruler);
    }
    return null;
}

function linesToGeometryDistance(ctx: EvaluationContext, geometry: DistanceGeometry) {
    const lngLatLines = [];
    for (const line of ctx.geometry()) {
        const lngLatLine = [];
        for (const point of line) {
            lngLatLine.push(getLngLatPoint(point, ctx.canonicalID()));
        }
        lngLatLines.push(lngLatLine);
    }
    const ruler = new CheapRuler(lngLatLines[0][0][1], 'meters');
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
        return pointSetToLinesDistance(
            geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates,
            geometry.type === 'LineString' /*isLine*/, lngLatLines, ruler);
    }
    if (geometry.type === 'MultiLineString') {
        let dist = Infinity;
        for (let i = 0; i < geometry.coordinates.length; i++) {
            const tempDist = pointSetToLinesDistance(geometry.coordinates[i], true /*isLine*/, lngLatLines, ruler, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
        return dist;
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        let dist = Infinity;
        for (let i = 0; i < lngLatLines.length; i++) {
            const tempDist = pointSetToPolygonsDistance(lngLatLines[i], true /*isLine*/,
                geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates,
                ruler, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
        return dist;
    }
    return null;
}

function polygonsToGeometryDistance(ctx: EvaluationContext, geometry: DistanceGeometry) {
    const lngLatPolygons = [];
    for (const polygon of classifyRings(ctx.geometry(), 0)) {
        const lngLatPolygon = [];
        for (let i = 0; i < polygon.length; ++i) {
            lngLatPolygon.push(getLngLatPoints(polygon[i], ctx.canonicalID()));
        }
        lngLatPolygons.push(lngLatPolygon);
    }
    const ruler = new CheapRuler(lngLatPolygons[0][0][0][1], 'meters');
    if (geometry.type === 'Point' || geometry.type === 'MultiPoint' || geometry.type === 'LineString') {
        return pointSetToPolygonsDistance(
            geometry.type === "Point" ? [geometry.coordinates] : geometry.coordinates,
            geometry.type === 'LineString' /*isLine*/, lngLatPolygons, ruler);
    }
    if (geometry.type === 'MultiLineString') {
        let dist = Infinity;
        for (let i = 0; i < geometry.coordinates.length; i++) {
            const tempDist = pointSetToPolygonsDistance(geometry.coordinates[i], true /*isLine*/, lngLatPolygons, ruler, dist);
            if (isNaN(tempDist)) return tempDist;
            if ((dist = Math.min(dist, tempDist)) === 0.0) return dist;
        }
        return dist;
    }
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        return polygonsToPolygonsDistance(
            geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates,
            lngLatPolygons, ruler);
    }
    return null;
}

function isTypeValid(type) {
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
    geojson: GeoJSON;
    geometries: DistanceGeometry;

    constructor(geojson: GeoJSON, geometries: DistanceGeometry) {
        this.type = NumberType;
        this.geojson = geojson;
        this.geometries = geometries;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length !== 2) {
            return context.error(
                `'distance' expression requires either one argument, but found ' ${args.length -
                    1} instead.`
            );
        }
        if (isValue(args[1])) {
            const geojson = (args[1]: Object);
            if (geojson.type === 'FeatureCollection') {
                for (let i = 0; i < geojson.features.length; ++i) {
                    if (isTypeValid(geojson.features[i].geometry.type)) {
                        return new Distance(geojson, geojson.features[i].geometry);
                    }
                }
            } else if (geojson.type === 'Feature') {
                if (isTypeValid(geojson.geometry.type)) {
                    return new Distance(geojson, geojson.geometry);
                }
            } else if (isTypeValid(geojson.type)) {
                return new Distance(geojson, geojson);
            }
        }
        return context.error(
            "'distance' expression needs to be an array with format [\'Distance\', GeoJSONObj]."
        );
    }

    evaluate(ctx: EvaluationContext) {
        if (ctx.geometry() !== null && ctx.canonicalID() !== null) {
            if (ctx.geometryType() === 'Point') {
                return pointsToGeometryDistance(ctx, this.geometries);
            }
            if (ctx.geometryType() === 'LineString') {
                return linesToGeometryDistance(ctx, this.geometries);
            }
            if (ctx.geometryType() === 'Polygon') {
                return polygonsToGeometryDistance(ctx, this.geometries);
            }
        }
        return null;
    }

    eachChild() {}

    outputDefined(): boolean {
        return true;
    }

    serialize(): Array<mixed> {
        return ['distance', this.geojson];
    }
}

export default Distance;
