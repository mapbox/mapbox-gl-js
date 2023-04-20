// @flow strict
declare module 'kdbush' {
    declare export default class KDBush<T> {
        points: Array<T>;
        constructor(points: Array<T>, getX: (T) => number, getY: (T) => number, nodeSize?: number, arrayType?: Class<$ArrayBufferView>): KDBush<T>;
        range(minX: number, minY: number, maxX: number, maxY: number): Array<number>;
    }
}
