// @flow strict
declare module 'grid-index' {
    declare class GridIndex {
        constructor(extent: number, n: number, padding: number): GridIndex;
        constructor(data: ArrayBuffer): GridIndex;

        insert(key: number, x1: number, y1: number, x2: number, y2: number): void;
        query(x1: number, y1: number, x2: number, y2: number, intersectionText?: (number, number, number, number) => boolean): Array<number>;
        toArrayBuffer(): ArrayBuffer;
    }

    declare export default Class<GridIndex>;
}
