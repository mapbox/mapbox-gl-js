declare module "cheap-ruler" {
    declare type GeometryPoint = [number, number] | [number, number, number];
    declare class CheapRuler {
        kx: number;
        ky: number;
        constructor(lat: number, units: string): CheapRuler;
        distance(a: GeometryPoint, b: GeometryPoint): number;
        pointToSegmentDistance(p: GeometryPoint, a: GeometryPoint, b: GeometryPoint) : number;
        pointOnLine(line: Array<GeometryPoint>, p: GeometryPoint): Object;
    }
    declare module.exports: typeof CheapRuler;
} 