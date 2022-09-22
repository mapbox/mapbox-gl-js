// @flow
declare module "@mapbox/vector-tile" {
    import type Pbf from 'pbf';
    import type Point from '@mapbox/point-geometry';
    import type { GeoJSONFeature } from '@mapbox/geojson-types';

    declare export interface IVectorTile {
        layers: {[_: string]: IVectorTileLayer};
    }
    declare export interface IVectorTileLayer {
        version?: ?number;
        name: string;
        extent: number;
        length: number;
        feature(i: number): IVectorTileFeature;
    }
    declare export interface IVectorTileFeature {
        extent: number;
        type: 1 | 2 | 3;
        id: number;
        properties: {[_: string]: string | number | boolean};

        loadGeometry(): Array<Array<Point>>;
        toGeoJSON(x: number, y: number, z: number): GeoJSONFeature;
    }

    declare export class VectorTile implements IVectorTile {
        constructor(pbf: Pbf): VectorTile;
        layers: {[_: string]: IVectorTileLayer};
    }
    declare export class VectorTileLayer implements IVectorTileLayer {
        version?: ?number;
        name: string;
        extent: number;
        length: number;
        feature(i: number): IVectorTileFeature;
    }
    declare export class VectorTileFeature implements IVectorTileFeature {
        extent: number;
        type: 1 | 2 | 3;
        id: number;
        properties: {[_: string]: string | number | boolean};

        loadGeometry(): Array<Array<Point>>;
        toGeoJSON(x: number, y: number, z: number): GeoJSONFeature;

        static types: ['Unknown', 'Point', 'LineString', 'Polygon'];
    }
}
