// @flow

import {isValue} from '../values.js';
import type {Type} from '../types.js';
import {BooleanType} from '../types.js';
import type {Expression} from '../expression.js';
import type ParsingContext from '../parsing_context.js';
import type EvaluationContext from '../evaluation_context.js';
import type {GeoJSON, GeoJSONPolygon, GeoJSONMultiPolygon} from '@mapbox/geojson-types';
import Point from '@mapbox/point-geometry';
import type {CanonicalTileID} from '../../../source/tile_id.js';

type GeoJSONPolygons =| GeoJSONPolygon | GeoJSONMultiPolygon;

// minX, minY, maxX, maxY
type BBox = [number, number, number, number];
const EXTENT = 8192;

function updateBBox(bbox: BBox, coord: Point) {
    bbox[0] = Math.min(bbox[0], coord[0]);
    bbox[1] = Math.min(bbox[1], coord[1]);
    bbox[2] = Math.max(bbox[2], coord[0]);
    bbox[3] = Math.max(bbox[3], coord[1]);
}

function mercatorXfromLng(lng: number) {
    return (180 + lng) / 360;
}

function mercatorYfromLat(lat: number) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

function boxWithinBox(bbox1: BBox, bbox2: BBox) {
    if (bbox1[0] <= bbox2[0]) return false;
    if (bbox1[2] >= bbox2[2]) return false;
    if (bbox1[1] <= bbox2[1]) return false;
    if (bbox1[3] >= bbox2[3]) return false;
    return true;
}

function getTileCoordinates(p, canonical: CanonicalTileID) {
    const x = mercatorXfromLng(p[0]);
    const y = mercatorYfromLat(p[1]);
    const tilesAtZoom = Math.pow(2, canonical.z);
    return [Math.round(x * tilesAtZoom * EXTENT), Math.round(y * tilesAtZoom * EXTENT)];
}

function onBoundary(p, p1, p2) {
    const x1 = p[0] - p1[0];
    const y1 = p[1] - p1[1];
    const x2 = p[0] - p2[0];
    const y2 = p[1] - p2[1];
    return (x1 * y2 - x2 * y1 === 0) && (x1 * x2 <= 0) && (y1 * y2 <= 0);
}

function rayIntersect(p, p1, p2) {
    return ((p1[1] > p[1]) !== (p2[1] > p[1])) && (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0]);
}

// ray casting algorithm for detecting if point is in polygon
function pointWithinPolygon(point, rings) {
    let inside = false;
    for (let i = 0, len = rings.length; i < len; i++) {
        const ring = rings[i];
        for (let j = 0, len2 = ring.length; j < len2 - 1; j++) {
            if (onBoundary(point, ring[j], ring[j + 1])) return false;
            if (rayIntersect(point, ring[j], ring[j + 1])) inside = !inside;
        }
    }
    return inside;
}

function pointWithinPolygons(point, polygons) {
    for (let i = 0; i < polygons.length; i++) {
        if (pointWithinPolygon(point, polygons[i])) return true;
    }
    return false;
}

function perp(v1, v2) {
    return (v1[0] * v2[1] - v1[1] * v2[0]);
}

// check if p1 and p2 are in different sides of line segment q1->q2
function  twoSided(p1, p2, q1, q2) {
    // q1->p1 (x1, y1), q1->p2 (x2, y2), q1->q2 (x3, y3)
    const x1 = p1[0] - q1[0];
    const y1 = p1[1] - q1[1];
    const x2 = p2[0] - q1[0];
    const y2 = p2[1] - q1[1];
    const x3 = q2[0] - q1[0];
    const y3 = q2[1] - q1[1];
    const det1 = (x1 * y3 - x3 * y1);
    const det2 =  (x2 * y3 - x3 * y2);
    if ((det1 > 0 && det2 < 0) || (det1 < 0 && det2 > 0)) return true;
    return false;
}
// a, b are end points for line segment1, c and d are end points for line segment2
function lineIntersectLine(a, b, c, d) {
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

function lineIntersectPolygon(p1, p2, polygon) {
    for (const ring of polygon) {
        // loop through every edge of the ring
        for (let j = 0; j < ring.length - 1; ++j) {
            if (lineIntersectLine(p1, p2, ring[j], ring[j + 1])) {
                return true;
            }
        }
    }
    return false;
}

function lineStringWithinPolygon(line, polygon) {
    // First, check if geometry points of line segments are all inside polygon
    for (let i = 0; i < line.length; ++i) {
        if (!pointWithinPolygon(line[i], polygon)) {
            return false;
        }
    }

    // Second, check if there is line segment intersecting polygon edge
    for (let i = 0; i < line.length - 1; ++i) {
        if (lineIntersectPolygon(line[i], line[i + 1], polygon)) {
            return false;
        }
    }
    return true;
}

function lineStringWithinPolygons(line, polygons) {
    for (let i = 0; i < polygons.length; i++) {
        if (lineStringWithinPolygon(line, polygons[i])) return true;
    }
    return false;
}

function getTilePolygon(coordinates, bbox, canonical) {
    const polygon = [];
    for (let i = 0; i < coordinates.length; i++) {
        const ring = [];
        for (let j = 0; j < coordinates[i].length; j++) {
            const coord = getTileCoordinates(coordinates[i][j], canonical);
            updateBBox(bbox, coord);
            ring.push(coord);
        }
        polygon.push(ring);
    }
    return polygon;
}

function getTilePolygons(coordinates, bbox, canonical) {
    const polygons = [];
    for (let i = 0; i < coordinates.length; i++) {
        const polygon = getTilePolygon(coordinates[i], bbox, canonical);
        polygons.push(polygon);
    }
    return polygons;
}

function updatePoint(p, bbox, polyBBox, worldSize) {
    if (p[0] < polyBBox[0] || p[0] > polyBBox[2]) {
        const halfWorldSize = worldSize * 0.5;
        let shift = (p[0] - polyBBox[0] > halfWorldSize) ? -worldSize : (polyBBox[0] - p[0] > halfWorldSize) ? worldSize : 0;
        if (shift === 0) {
            shift = (p[0] - polyBBox[2] > halfWorldSize) ? -worldSize : (polyBBox[2] - p[0] > halfWorldSize) ? worldSize : 0;
        }
        p[0] += shift;
    }
    updateBBox(bbox, p);
}

function resetBBox(bbox) {
    bbox[0] = bbox[1] = Infinity;
    bbox[2] = bbox[3] = -Infinity;
}

function getTilePoints(geometry, pointBBox, polyBBox, canonical) {
    const worldSize = Math.pow(2, canonical.z) * EXTENT;
    const shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
    const tilePoints = [];
    for (const points of geometry) {
        for (const point of points) {
            const p = [point.x + shifts[0], point.y + shifts[1]];
            updatePoint(p, pointBBox, polyBBox, worldSize);
            tilePoints.push(p);
        }
    }
    return tilePoints;
}

function getTileLines(geometry, lineBBox, polyBBox, canonical) {
    const worldSize = Math.pow(2, canonical.z) * EXTENT;
    const shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
    const tileLines = [];
    for (const line of geometry) {
        const tileLine = [];
        for (const point of line) {
            const p = [point.x + shifts[0], point.y + shifts[1]];
            updateBBox(lineBBox, p);
            tileLine.push(p);
        }
        tileLines.push(tileLine);
    }
    if (lineBBox[2] - lineBBox[0] <= worldSize / 2) {
        resetBBox(lineBBox);
        for (const line of tileLines) {
            for (const p of line) {
                updatePoint(p, lineBBox, polyBBox, worldSize);
            }
        }
    }
    return tileLines;
}

function pointsWithinPolygons(ctx: EvaluationContext, polygonGeometry: GeoJSONPolygons) {
    const pointBBox = [Infinity, Infinity, -Infinity, -Infinity];
    const polyBBox = [Infinity, Infinity, -Infinity, -Infinity];

    const canonical = ctx.canonicalID();

    if (polygonGeometry.type === 'Polygon') {
        const tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
        const tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
        if (!boxWithinBox(pointBBox, polyBBox)) return false;

        for (const point of tilePoints) {
            if (!pointWithinPolygon(point, tilePolygon)) return false;
        }
    }
    if (polygonGeometry.type === 'MultiPolygon') {
        const tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
        const tilePoints = getTilePoints(ctx.geometry(), pointBBox, polyBBox, canonical);
        if (!boxWithinBox(pointBBox, polyBBox)) return false;

        for (const point of tilePoints) {
            if (!pointWithinPolygons(point, tilePolygons)) return false;
        }
    }

    return true;
}

function linesWithinPolygons(ctx: EvaluationContext, polygonGeometry: GeoJSONPolygons) {
    const lineBBox = [Infinity, Infinity, -Infinity, -Infinity];
    const polyBBox = [Infinity, Infinity, -Infinity, -Infinity];

    const canonical = ctx.canonicalID();

    if (polygonGeometry.type === 'Polygon') {
        const tilePolygon = getTilePolygon(polygonGeometry.coordinates, polyBBox, canonical);
        const tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
        if (!boxWithinBox(lineBBox, polyBBox)) return false;

        for (const line of tileLines) {
            if (!lineStringWithinPolygon(line, tilePolygon)) return false;
        }
    }
    if (polygonGeometry.type === 'MultiPolygon') {
        const tilePolygons = getTilePolygons(polygonGeometry.coordinates, polyBBox, canonical);
        const tileLines = getTileLines(ctx.geometry(), lineBBox, polyBBox, canonical);
        if (!boxWithinBox(lineBBox, polyBBox)) return false;

        for (const line of tileLines) {
            if (!lineStringWithinPolygons(line, tilePolygons)) return false;
        }
    }
    return true;
}

class Within implements Expression {
    type: Type;
    geojson: GeoJSON
    geometries: GeoJSONPolygons;

    constructor(geojson: GeoJSON, geometries: GeoJSONPolygons) {
        this.type = BooleanType;
        this.geojson = geojson;
        this.geometries = geometries;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length !== 2)
            return context.error(`'within' expression requires exactly one argument, but found ${args.length - 1} instead.`);
        if (isValue(args[1])) {
            const geojson = (args[1]: Object);
            if (geojson.type === 'FeatureCollection') {
                for (let i = 0; i < geojson.features.length; ++i) {
                    const type = geojson.features[i].geometry.type;
                    if (type === 'Polygon' || type === 'MultiPolygon') {
                        return new Within(geojson, geojson.features[i].geometry);
                    }
                }
            } else if (geojson.type === 'Feature') {
                const type = geojson.geometry.type;
                if (type === 'Polygon' || type === 'MultiPolygon') {
                    return new Within(geojson, geojson.geometry);
                }
            } else if (geojson.type  === 'Polygon' || geojson.type === 'MultiPolygon') {
                return new Within(geojson, geojson);
            }
        }
        return context.error(`'within' expression requires valid geojson object that contains polygon geometry type.`);
    }

    evaluate(ctx: EvaluationContext) {
        if (ctx.geometry() != null && ctx.canonicalID() != null) {
            if (ctx.geometryType() === 'Point') {
                return pointsWithinPolygons(ctx, this.geometries);
            } else if (ctx.geometryType() === 'LineString') {
                return linesWithinPolygons(ctx, this.geometries);
            }
        }
        return false;
    }

    eachChild() {}

    outputDefined(): boolean {
        return true;
    }

    serialize(): Array<mixed> {
        return ["within", this.geojson];
    }

}

export default Within;
