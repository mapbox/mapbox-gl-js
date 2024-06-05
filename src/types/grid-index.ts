// @ts-nocheck
export interface GridIndex {
    new(extent: number, n: number, padding: number): this;
    new(data: ArrayBuffer): this;
    insert(key: number, x1: number, y1: number, x2: number, y2: number): void;
    query(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        intersectionText?: (arg1: number, arg2: number, arg3: number, arg4: number) => boolean,
    ): Array<number>;
    toArrayBuffer(): ArrayBuffer;
}
