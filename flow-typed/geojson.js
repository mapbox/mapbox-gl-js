// @flow strict

type GeoJSONPosition = [number, number] | [number, number, number];
type Geometry<T, C> = { type: T, coordinates: C }

declare module "@mapbox/geojson-types" {
    declare export type GeoJSONPoint = Geometry<'Point', GeoJSONPosition>;
    declare export type GeoJSONMultiPoint = Geometry<'MultiPoint', Array<GeoJSONPosition>>;

    declare export type GeoJSONLineString = Geometry<'LineString', Array<GeoJSONPosition>>;
    declare export type GeoJSONMultiLineString = Geometry<'MultiLineString', Array<Array<GeoJSONPosition>>>;

    declare export type GeoJSONPolygon = Geometry<'Polygon', Array<Array<GeoJSONPosition>>>;
    declare export type GeoJSONMultiPolygon = Geometry<'MultiPolygon', Array<Array<Array<GeoJSONPosition>>>>;

    declare export type GeoJSONGeometry =
        | GeoJSONPoint
        | GeoJSONMultiPoint
        | GeoJSONLineString
        | GeoJSONMultiLineString
        | GeoJSONPolygon
        | GeoJSONMultiPolygon
        | GeoJSONGeometryCollection;

    declare export type GeoJSONGeometryCollection = {
        type: 'GeometryCollection',
        geometries: Array<GeoJSONGeometry>
    };

    declare export type GeoJSONFeature = {
        type: 'Feature',
        geometry: ?GeoJSONGeometry,
        properties: ?{},
        id?: number | string
    };

    declare export type GeoJSONFeatureCollection = {
        type: 'FeatureCollection',
        features: Array<GeoJSONFeature>
    };

    declare export type GeoJSON = GeoJSONGeometry | GeoJSONFeature | GeoJSONFeatureCollection;
}
