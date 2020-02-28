// @flow

import {isValue} from '../values';
import type {Type} from '../types';
import {BooleanType} from '../types';
import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {GeoJSON, GeoJSONPolygon, GeoJSONMultiPolygon} from '@mapbox/geojson-types';
import MercatorCoordinate from '../../../geo/mercator_coordinate';
import EXTENT from '../../../data/extent';
import Point from '@mapbox/point-geometry';

type GeoJSONPolygons =| GeoJSONPolygon | GeoJSONMultiPolygon;

type BBox = [number, number, number, number];

function calcBBox(bbox: BBox, geom, type) {
    if (type === 'Point') {
        updateBBox(bbox, geom);
    } else if (type === 'MultiPoint' || type === 'LineString') {
        for (let i = 0; i < geom.length; ++i) {
            updateBBox(bbox, geom[i]);
        }
    } else if (type === 'Polygon' || type === 'MultiLineString') {
        for (let i = 0; i < geom.length; i++) {
            for (let j = 0; j < geom[i].length; j++) {
                updateBBox(bbox, geom[i][j]);
            }
        }
    } else if (type === 'MultiPolygon') {
        for (let i = 0; i < geom.length; i++) {
            for (let j = 0; j < geom[i].length; j++) {
                for (let k = 0; k < geom[i][j].length; k++) {
                    updateBBox(bbox, geom[i][j][k]);
                }
            }
        }
    }
}

function updateBBox(bbox: BBox, coord: Point) {
    bbox[0] = Math.min(bbox[0], coord[0]);
    bbox[1] = Math.min(bbox[1], coord[1]);
    bbox[2] = Math.max(bbox[2], coord[0]);
    bbox[3] = Math.max(bbox[3], coord[1]);
}

function boxWithinBox(bbox1, bbox2) {
    if (bbox1[0] <= bbox2[0]) return false;
    if (bbox1[2] >= bbox2[2]) return false;
    if (bbox1[1] <= bbox2[1]) return false;
    if (bbox1[3] >= bbox2[3]) return false;
    return true;
}

function getLngLatPoint(coord: Point, canonical) {
    const tilesAtZoom = Math.pow(2, canonical.z);
    const x = (coord.x / EXTENT + canonical.x) / tilesAtZoom;
    const y = (coord.y / EXTENT + canonical.y) / tilesAtZoom;
    const p = new MercatorCoordinate(x, y).toLngLat();

    return [p.lng, p.lat];
}

function getLngLatPoints(line, canonical) {
    const coords = [];
    for (let i = 0; i < line.length; ++i) {
        coords.push(getLngLatPoint(line[i], canonical));
    }
    return coords;
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
    if (polygons.type === 'Polygon') {
        return pointWithinPolygon(point, polygons.coordinates);
    }
    for (let i = 0; i < polygons.coordinates.length; i++) {
        if (!pointWithinPolygon(point, polygons.coordinates[i])) return false;
    }
    return true;
}

// a, b are end points for line segment1, c and d are end points for line segment2
function lineIntersectLine(a, b, c, d) {
    const perp = (v1, v2) => { return (v1[0] * v2[1] - v1[1] * v2[0]); };

    // check if two segments are parallel or not
    // precondition is end point a, b is inside polygon, if line a->b is
    // parallel to polygon edge c->d, then a->b won't intersect with c->d
    const vectorP = [b[0] - a[0], b[1] - a[1]];
    const vectorQ = [d[0] - c[0], d[1] - c[1]];
    if (perp(vectorQ, vectorP) === 0) return false;

    // check if p1 and p2 are in different sides of line segment q1->q2
    const twoSided = (p1, p2, q1, q2)  => {
        // q1->p1 (x1, y1), q1->p2 (x2, y2), q1->q2 (x3, y3)
        const x1 = p1[0] - q1[0];
        const y1 = p1[1] - q1[1];
        const x2 = p2[0] - q1[0];
        const y2 = p2[1] - q1[1];
        const x3 = q2[0] - q1[0];
        const y3 = q2[1] - q1[1];
        if ((x1 * y3 - x3 * y1) * (x2 * y3 - x3 * y2) < 0) return true;
        return false;
    };

    // If lines are intersecting with each other, the relative location should be:
    // a and b lie in different sides of segment c->d
    // c and d lie in different sides of segment a->b
    if (twoSided(a, b, c, d) && twoSided(c, d, a, b)) return true;
    return false;
}

function lineIntersectPolygon(p1, p2, polygon) {
    for (let i = 0; i < polygon.length; ++i) {
        const ring = polygon[i];
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
    if (polygons.type === 'Polygon') {
        return lineStringWithinPolygon(line, polygons.coordinates);
    }
    for (let i = 0; i < polygons.coordinates.length; i++) {
        if (!lineStringWithinPolygon(line, polygons.coordinates[i])) return false;
    }
    return true;
}

function pointsWithinPolygons(ctx: EvaluationContext, polygonGeometry: GeoJSONPolygons, polyBBox: BBox) {
    const pointBBox = [Infinity, Infinity, -Infinity, -Infinity];
    const lngLatPoints = [];
    for (const points of ctx.geometry()) {
        for (const point of points) {
            const p = getLngLatPoint(point, ctx.canonicalID());
            lngLatPoints.push(p);
            updateBBox(pointBBox, p);
        }
    }
    if (!boxWithinBox(pointBBox, polyBBox)) return false;
    for (let i = 0; i < lngLatPoints.length; ++i) {
        if (!pointWithinPolygons(lngLatPoints[i], polygonGeometry)) return false;
    }
    return true;
}

function linesWithinPolygons(ctx: EvaluationContext, polygonGeometry: GeoJSONPolygons, polyBBox: BBox) {
    const lineBBox = [Infinity, Infinity, -Infinity, -Infinity];
    const lineCoords = [];
    for (const line of ctx.geometry()) {
        const lineCoord = getLngLatPoints(line, ctx.canonicalID());
        lineCoords.push(lineCoord);
        calcBBox(lineBBox, lineCoord, 'LineString');
    }
    if (!boxWithinBox(lineBBox, polyBBox)) return false;
    for (let i = 0; i < lineCoords.length; ++i) {
        if (!lineStringWithinPolygons(lineCoords[i], polygonGeometry)) return false;
    }
    return true;
}

class Within implements Expression {
    type: Type;
    geojson: GeoJSON
    geometries: GeoJSONPolygons;
    polyBBox: BBox;

    constructor(geojson: GeoJSON, geometries: GeoJSONPolygons) {
        this.type = BooleanType;
        this.geojson = geojson;
        this.geometries = geometries;
        this.polyBBox = [Infinity, Infinity, -Infinity, -Infinity];
        calcBBox(this.polyBBox, this.geometries.coordinates, this.geometries.type);
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
                return pointsWithinPolygons(ctx, this.geometries, this.polyBBox);
            } else if (ctx.geometryType() === 'LineString') {
                return linesWithinPolygons(ctx, this.geometries, this.polyBBox);
            }
        }
        return false;
    }

    eachChild() {}

    possibleOutputs() {
        return [true, false];
    }

    serialize(): Array<mixed> {
        return ["within", this.geojson];
    }

}

export default Within;
