declare module "cheap-ruler" {
    declare class CheapRuler {
        kx: number;
        ky: number;
        constructor(lat: number, units: string): CheapRuler;
        distance(a: Array<number>, b: Array<number>): number;
        bearing(a: Array<number>, b: Array<number>): number;
        destination(p: Array<number>, dist: number , bearing: number): Array<number>;
        offset(p: Array<number>, dx: number, dy: number): Array<number>;
        lineDistance(points: Array<Array<number>>): number;
        area(polygon: Array<Array<Array<number>>>): number;
        along(line: Array<Array<number>>, dist: number): Array<number>;
        pointToSegmentDistance(p: GeometryPoint, a: GeometryPoint, b: GeometryPoint) : number;
        pointOnLine(line: Array<Array<number>>, p: Array<number>): Object;
        lineSlice(start: Array<number>, stop: Array<number>, line: Array<Array<number>>): Array<Array<number>>;
        lineSliceAlong(start: Array<number>, stop: Array<number>, line: Array<Array<number>>): Array<Array<number>>;
        bufferPoint(p: Array<number>, buffer: number): Array<number>;
        bufferBBox(bbox: Array<number>, buffer: number): Array<number>;
        insideBBox(p: Array<number>, bbox: Array<number>): boolean;

    }
    declare module.exports: typeof CheapRuler;
}