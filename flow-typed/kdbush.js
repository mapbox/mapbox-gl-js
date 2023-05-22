// @flow strict
declare module 'kdbush' {
    declare export default class KDBush {
        constructor(numPoints: number, nodeSize?: number, arrayType?: Class<$ArrayBufferView>): KDBush;
        add(x: number, y: number): number;
        finish(): void;
        range(minX: number, minY: number, maxX: number, maxY: number): Array<number>;
    }
}
