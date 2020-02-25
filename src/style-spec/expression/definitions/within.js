// @flow

import {isValue} from '../values';
import type {Type} from '../types';
import {BooleanType} from '../types';
import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import type {CanonicalTileID} from '../../../source/tile_id';
import type {GeoJSONPolygon, GeoJSONMultiPolygon} from '@mapbox/geojson-types';
import type {Feature} from '../index';
import MercatorCoordinate from '../../../geo/mercator_coordinate';
import EXTENT from '../../../data/extent';
import Point from '@mapbox/point-geometry';

type GeoJSONPolygons =| GeoJSONPolygon | GeoJSONMultiPolygon;

function rayIntersect(p, p1, p2) {
    return ((p1[1] > p[1]) !== (p2[1] > p[1])) && (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0]);
}

// ray casting algorithm for detecting if point is in polygon
function pointWithinPolygon(rings, p) {
    let inside = false;
    for (let i = 0, len = rings.length; i < len; i++) {
        const ring = rings[i];
        for (let j = 0, len2 = ring.length, k = len2 - 1; j < len2; k = j++) {
            if (rayIntersect(p, ring[j], ring[k])) inside = !inside;
        }
    }
    return inside;
}

function pointWithinPolygons(polygons, lngLat) {
    const p = [lngLat.lng, lngLat.lat];
    if (polygons.type === 'Polygon') {
        return pointWithinPolygon(polygons.coordinates, p);
    }
    for (let i = 0; i < polygons.coordinates.length; i++) {
        if (!pointWithinPolygon(polygons.coordinates[i], p)) return false;
    }
    return true;
}

function getMercatorPoint(coord: Point, canonical: CanonicalTileID) {
    const tilesAtZoom = Math.pow(2, canonical.z);
    const x = (coord.x / EXTENT + canonical.x) / tilesAtZoom;
    const y = (coord.y / EXTENT + canonical.y) / tilesAtZoom;
    return new MercatorCoordinate(x, y);
}

function pointsWithinPolygons(feature: Feature, canonical: CanonicalTileID, polygonGeometry: GeoJSONPolygons) {

    for (const points of feature.geometry) {
        for (const point of points) {
            if (!pointWithinPolygons(polygonGeometry, getMercatorPoint(point, canonical).toLngLat())) return false;
        }
    }

    return true;
}

class Within implements Expression {
    type: Type;
    geojson: GeoJSONPolygons;

    constructor(geojson: GeoJSONPolygons) {
        this.type = BooleanType;
        this.geojson = geojson;
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
                        return new Within(geojson.features[i].geometry);
                    }
                }
            } else if (geojson.type === 'Feature') {
                const type = geojson.feature.geometry.type;
                if (type === 'Polygon' || type === 'MultiPolygon') {
                    return new Within(geojson.feature.geometry);
                }
            } else if (geojson.type  === 'Polygon' || geojson.type === 'MultiPolygon') {
                return new Within(geojson);
            }
        }
        return context.error(`'within' expression requires valid geojson source that contains polygon geometry type.`);
    }

    evaluate(ctx: EvaluationContext) {
        if (ctx.feature != null && ctx.canonical != null && ctx.geometryType() === 'Point') {
            return pointsWithinPolygons(ctx.feature, ctx.canonical, this.geojson);
        } else if (ctx.geometryType() === 'LineString') {
            return true;
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
