// @flow

import {isValue} from '../values.js';
import type {Type} from '../types.js';
import {BooleanType} from '../types.js';
import type {Expression, SerializedExpression} from '../expression.js';
import type ParsingContext from '../parsing_context.js';
import type EvaluationContext from '../evaluation_context.js';
import type Point from '@mapbox/point-geometry';
import type {GeoJSON, GeoJSONPosition, GeoJSONPolygon, GeoJSONMultiPolygon} from '@mapbox/geojson-types';
import type {CanonicalTileID} from '../../../source/tile_id.js';
import {updateBBox, boxWithinBox, pointWithinPolygon, segmentIntersectSegment} from '../../util/geometry_util.js';
import type {BBox} from '../../util/geometry_util.js';

type GeoJSONPolygons =| GeoJSONPolygon | GeoJSONMultiPolygon;

const EXTENT = 8192;

function mercatorXfromLng(lng: number) {
    return (180 + lng) / 360;
}

function mercatorYfromLat(lat: number) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}

function getTileCoordinates(p: GeoJSONPosition, canonical: CanonicalTileID) {
    const x = mercatorXfromLng(p[0]);
    const y = mercatorYfromLat(p[1]);
    const tilesAtZoom = Math.pow(2, canonical.z);
    return [Math.round(x * tilesAtZoom * EXTENT), Math.round(y * tilesAtZoom * EXTENT)];
}

function pointWithinPolygons(point: GeoJSONPosition, polygons: Array<Array<Array<GeoJSONPosition>>>) {
    for (let i = 0; i < polygons.length; i++) {
        if (pointWithinPolygon(point, polygons[i])) return true;
    }
    return false;
}

function lineIntersectPolygon(p1: GeoJSONPosition, p2: GeoJSONPosition, polygon: Array<Array<GeoJSONPosition>>) {
    for (const ring of polygon) {
        // loop through every edge of the ring
        for (let j = 0, len = ring.length, k = len - 1; j < len; k = j++) {
            const q1 = ring[k];
            const q2 = ring[j];
            if (segmentIntersectSegment(p1, p2, q1, q2)) {
                return true;
            }
        }
    }
    return false;
}

function lineStringWithinPolygon(line: Array<GeoJSONPosition>, polygon: Array<Array<GeoJSONPosition>>) {
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

function lineStringWithinPolygons(line: Array<GeoJSONPosition>, polygons: Array<Array<Array<GeoJSONPosition>>>) {
    for (let i = 0; i < polygons.length; i++) {
        if (lineStringWithinPolygon(line, polygons[i])) return true;
    }
    return false;
}

function getTilePolygon(coordinates: Array<Array<GeoJSONPosition>>, bbox: BBox, canonical: CanonicalTileID) {
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

function getTilePolygons(coordinates: Array<Array<Array<GeoJSONPosition>>>, bbox: BBox, canonical: CanonicalTileID) {
    const polygons = [];
    for (let i = 0; i < coordinates.length; i++) {
        const polygon = getTilePolygon(coordinates[i], bbox, canonical);
        polygons.push(polygon);
    }
    return polygons;
}

function updatePoint(p: GeoJSONPosition, bbox: BBox, polyBBox: Array<number>, worldSize: number) {
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

function resetBBox(bbox: BBox) {
    bbox[0] = bbox[1] = Infinity;
    bbox[2] = bbox[3] = -Infinity;
}

function getTilePoints(geometry: ?Array<Array<Point>>, pointBBox: BBox, polyBBox: Array<number>, canonical: CanonicalTileID) {
    const worldSize = Math.pow(2, canonical.z) * EXTENT;
    const shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
    const tilePoints = [];
    if (!geometry) return tilePoints;
    for (const points of geometry) {
        for (const point of points) {
            const p = [point.x + shifts[0], point.y + shifts[1]];
            updatePoint(p, pointBBox, polyBBox, worldSize);
            tilePoints.push(p);
        }
    }
    return tilePoints;
}

function getTileLines(geometry: ?Array<Array<Point>>, lineBBox: BBox, polyBBox: Array<number>, canonical: CanonicalTileID) {
    const worldSize = Math.pow(2, canonical.z) * EXTENT;
    const shifts = [canonical.x * EXTENT, canonical.y * EXTENT];
    const tileLines: Array<Array<GeoJSONPosition>> = [];
    if (!geometry) return tileLines;
    for (const line of geometry) {
        const tileLine = [];
        for (const point of line) {
            const p: GeoJSONPosition = [point.x + shifts[0], point.y + shifts[1]];
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
    if (!canonical) {
        return false;
    }

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
    if (!canonical) {
        return false;
    }

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

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext): ?Within {
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

    evaluate(ctx: EvaluationContext): boolean {
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

    serialize(): SerializedExpression {
        return ["within", this.geojson];
    }

}

export default Within;
