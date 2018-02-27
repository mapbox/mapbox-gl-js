'use strict';

import { test } from 'mapbox-gl-js-test';
import GridIndex from '../../../src/symbol/grid_index';

test('GridIndex', (t) => {

    t.test('indexes features', (t) => {
        const grid = new GridIndex(100, 100, 10);
        grid.insert(0, 4, 10, 6, 30);
        grid.insert(1, 4, 10, 30, 12);
        grid.insert(2, -10, 30, 5, 35);

        t.deepEqual(grid.query(4, 10, 5, 11).sort(), [0, 1]);
        t.deepEqual(grid.query(24, 10, 25, 11).sort(), [1]);
        t.deepEqual(grid.query(40, 40, 100, 100), []);
        t.deepEqual(grid.query(-6, 0, 3, 100), [2]);
        t.deepEqual(grid.query(-Infinity, -Infinity, Infinity, Infinity).sort(), [0, 1, 2]);
        t.end();
    });

    t.test('returns multiple copies of a key if multiple boxes were inserted with the same key', (t) => {
        const grid = new GridIndex(100, 100, 10);
        const key = 123;
        grid.insert(key, 3, 3, 4, 4);
        grid.insert(key, 13, 13, 14, 14);
        grid.insert(key, 23, 23, 24, 24);
        t.deepEqual(grid.query(0, 0, 30, 30), [key, key, key]);
        t.end();
    });

    t.test('circle-circle intersection', (t) => {
        const grid = new GridIndex(100, 100, 10);
        grid.insertCircle(0, 50, 50, 10);
        grid.insertCircle(1, 60, 60, 15);
        grid.insertCircle(2, -10, 110, 20);

        t.ok(grid.hitTestCircle(55, 55, 2));
        t.notOk(grid.hitTestCircle(10, 10, 10));
        t.ok(grid.hitTestCircle(0, 100, 10));
        t.ok(grid.hitTestCircle(80, 60, 10));

        t.end();
    });

    t.test('circle-rectangle intersection', (t) => {
        const grid = new GridIndex(100, 100, 10);
        grid.insertCircle(0, 50, 50, 10);
        grid.insertCircle(1, 60, 60, 15);
        grid.insertCircle(2, -10, 110, 20);

        t.deepEqual(grid.query(45, 45, 55, 55), [0, 1]);
        t.deepEqual(grid.query(0, 0, 30, 30), []);
        t.deepEqual(grid.query(0, 80, 20, 100), [2]);

        t.end();
    });

    t.end();
});
