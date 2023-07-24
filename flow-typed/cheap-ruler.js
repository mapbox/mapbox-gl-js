// @flow strict

declare module 'cheap-ruler' {
    import type { GeoJSONPosition} from '@mapbox/geojson-types';
    declare export default class CheapRuler {
        kx: number;
        ky: number;
        constructor(lat: number, units: string): CheapRuler;
        distance(a: GeoJSONPosition, b: GeoJSONPosition): number;
        bearing(a: GeoJSONPosition, b: GeoJSONPosition): number;
        destination(p: GeoJSONPosition, dist: number , bearing: number): GeoJSONPosition;
        offset(p: GeoJSONPosition, dx: number, dy: number): GeoJSONPosition;
        lineDistance(points: Array<GeoJSONPosition>): number;
        area(polygon: Array<Array<GeoJSONPosition>>): number;
        along(line: Array<GeoJSONPosition>, dist: number): GeoJSONPosition;
        pointToSegmentDistance(p: GeoJSONPosition, a: GeoJSONPosition, b: GeoJSONPosition): number;
        pointOnLine(line: Array<GeoJSONPosition>, p: GeoJSONPosition): Object;
        lineSlice(start: GeoJSONPosition, stop: GeoJSONPosition, line: Array<GeoJSONPosition>): Array<GeoJSONPosition>;
        lineSliceAlong(start: GeoJSONPosition, stop: GeoJSONPosition, line: Array<GeoJSONPosition>): Array<GeoJSONPosition>;
        bufferPoint(p: GeoJSONPosition, buffer: number): GeoJSONPosition;
        bufferBBox(bbox: GeoJSONPosition, buffer: number): GeoJSONPosition;
        insideBBox(p: GeoJSONPosition, bbox: GeoJSONPosition): boolean;

    }
}
