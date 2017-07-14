type Position = [number, number] | [number, number, number];
type Geometry<T, C> = { type: T, coordinates: C }

declare type      GeoJSONPoint = Geometry<     'Point',       Position>;
declare type GeoJSONMultiPoint = Geometry<'MultiPoint', Array<Position>>;

declare type      GeoJSONLineString = Geometry<     'LineString',       Array<Position>>;
declare type GeoJSONMultiLineString = Geometry<'MultiLineString', Array<Array<Position>>>;

declare type      GeoJSONPolygon = Geometry<     'Polygon',       Array<Array<Position>>>;
declare type GeoJSONMultiPolygon = Geometry<'MultiPolygon', Array<Array<Array<Position>>>>;

declare type GeoJSONGeometry =
    | GeoJSONPoint
    | GeoJSONMultiPoint
    | GeoJSONLineString
    | GeoJSONMultiLineString
    | GeoJSONPolygon
    | GeoJSONMultiPolygon
    | GeoJSONGeometryCollection;

declare type GeoJSONGeometryCollection = {
    type: 'GeometryCollection',
    geometries: Array<GeoJSONGeometry>
};

declare type GeoJSONFeature = {
    type: 'Feature',
    geometry: ?GeoJSONGeometry,
    properties: {},
    id?: number | string
};

declare type GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: Array<GeoJSONFeature>
};

declare type GeoJSON = GeoJSONGeometry | GeoJSONFeature | GeoJSONFeatureCollection;
