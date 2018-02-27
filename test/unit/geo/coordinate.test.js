'use strict';

import { test } from 'mapbox-gl-js-test';
import Coordinate from '../../../src/geo/coordinate';

test('Coordinate', (t) => {
    t.test('#constructor', (t) => {
        const c = new Coordinate(1, 2, 3);
        t.equal(c.column, 1);
        t.equal(c.row, 2);
        t.equal(c.zoom, 3);
        t.end();
    });

    t.test('#zoomTo', (t) => {
        let c = new Coordinate(1, 2, 3);
        c = c.zoomTo(3);
        t.equal(c.column, 1);
        t.equal(c.row, 2);
        t.equal(c.zoom, 3);
        c = c.zoomTo(2);
        t.equal(c.column, 0.5);
        t.equal(c.row, 1);
        t.equal(c.zoom, 2);
        c = c.zoomTo(5);
        t.equal(c.column, 4);
        t.equal(c.row, 8);
        t.equal(c.zoom, 5);
        t.end();
    });

    t.test('#sub', (t) => {
        const o = new Coordinate(5, 4, 3);
        const c = new Coordinate(1, 2, 3);
        const r = o.sub(c);
        t.equal(r.column, 4);
        t.equal(r.row, 2);
        t.equal(r.zoom, 3);
        const otherZoom = new Coordinate(4, 4, 4);
        const r2 = o.sub(otherZoom);
        t.equal(r2.column, 3);
        t.equal(r2.row, 2);
        t.equal(r2.zoom, 3);
        t.end();
    });

    t.end();
});
