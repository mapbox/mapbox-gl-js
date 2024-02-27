import {describe, test, expect} from "../../util/vitest.js";
import GridIndex from '../../../src/symbol/grid_index.js';

describe('GridIndex', () => {
    test('indexes features', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insert(0, 4, 10, 6, 30);
        grid.insert(1, 4, 10, 30, 12);
        grid.insert(2, -10, 30, 5, 35);

        expect(grid.query(4, 10, 5, 11).map(x => x.key).sort()).toEqual([0, 1]);
        expect(grid.query(24, 10, 25, 11).map(x => x.key).sort()).toEqual([1]);
        expect(grid.query(40, 40, 100, 100).map(x => x.key)).toEqual([]);
        expect(grid.query(-6, 0, 3, 100).map(x => x.key)).toEqual([2]);
        expect(
            grid.query(-Infinity, -Infinity, Infinity, Infinity).map(x => x.key).sort()
        ).toEqual([0, 1, 2]);
    });

    test(
        'returns multiple copies of a key if multiple boxes were inserted with the same key',
        () => {
            const grid = new GridIndex(100, 100, 10);
            const key = 123;
            grid.insert(key, 3, 3, 4, 4);
            grid.insert(key, 13, 13, 14, 14);
            grid.insert(key, 23, 23, 24, 24);
            expect(grid.query(0, 0, 30, 30).map(x => x.key)).toEqual([key, key, key]);
        }
    );

    test('circle-circle intersection', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insertCircle(0, 50, 50, 10);
        grid.insertCircle(1, 60, 60, 15);
        grid.insertCircle(2, -10, 110, 20);

        expect(grid.hitTestCircle(55, 55, 2)).toBeTruthy();
        expect(grid.hitTestCircle(10, 10, 10)).toBeFalsy();
        expect(grid.hitTestCircle(0, 100, 10)).toBeTruthy();
        expect(grid.hitTestCircle(80, 60, 10)).toBeTruthy();
    });

    test('circle-rectangle intersection', () => {
        const grid = new GridIndex(100, 100, 10);
        grid.insertCircle(0, 50, 50, 10);
        grid.insertCircle(1, 60, 60, 15);
        grid.insertCircle(2, -10, 110, 20);

        expect(grid.query(45, 45, 55, 55).map(x => x.key)).toEqual([0, 1]);
        expect(grid.query(0, 0, 30, 30).map(x => x.key)).toEqual([]);
        expect(grid.query(0, 80, 20, 100).map(x => x.key)).toEqual([2]);
    });
});
