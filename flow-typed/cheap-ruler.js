declare module "cheap-ruler" {
    declare type GeometryPoint = [number, number] | [number, number, number];
    declare class CheapRuler {
        kx: number;
        ky: number;
        constructor(lat: number, units: string): CheapRuler;
        distance(a: GeometryPoint, b: GeometryPoint): number;
        bearing(a: GeometryPoint, b: GeometryPoint): number;
        destination(p: GeometryPoint, dist: number , bearing: number): GeometryPoint;
        offset(p: GeometryPoint, dx: number, dy: number): GeometryPoint;
        lineDistance(points: Array<GeometryPoint>): number;
        area(polygon: Array<Array<GeometryPoint>>): number;
        along(line: Array<GeometryPoint>, dist: number): GeometryPoint;
        pointToSegmentDistance(p: GeometryPoint, a: GeometryPoint, b: GeometryPoint) : number;
        pointOnLine(line: Array<GeometryPoint>, p: GeometryPoint): Object;
        lineSlice(start: GeometryPoint, stop: GeometryPoint, line: Array<GeometryPoint>): Array<GeometryPoint>;
        lineSliceAlong(start: GeometryPoint, stop: GeometryPoint, line: Array<GeometryPoint>): Array<GeometryPoint>;
        bufferPoint(p: GeometryPoint, buffer: number): GeometryPoint;
        bufferBBox(bbox: GeometryPoint, buffer: number): GeometryPoint;
        insideBBox(p: GeometryPoint, bbox: GeometryPoint): boolean;

    }
    declare module.exports: typeof CheapRuler;
} 