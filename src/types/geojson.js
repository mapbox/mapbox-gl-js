// @flow

import type {
    Point,
    MultiPoint,
    LineString,
    MultiLineString,
    Polygon,
    MultiPolygon,
    GeometryCollection,
    Feature,
    FeatureCollection
} from 'flow-geojson';

export type GeoJSONGeometry = Point | MultiPoint | LineString | MultiLineString | Polygon | MultiPolygon | GeometryCollection;
export type GeoJSON = GeoJSONGeometry | Feature | FeatureCollection;
