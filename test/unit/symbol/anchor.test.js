'use strict';

const test = require('mapbox-gl-js-test').test;
const Anchor = require('../../../src/symbol/anchor');

test('Anchor', (t) => {
    t.test('#constructor', (t) => {
        t.ok(new Anchor(0, 0, 0, []) instanceof Anchor, 'creates an object');
        t.ok(new Anchor(0, 0, 0, [], []) instanceof Anchor, 'creates an object with a segment');
        t.end();
    });
    t.test('#clone', (t) => {
        const a = new Anchor(1, 2, 3, []);
        const b = new Anchor(1, 2, 3, []);
        t.deepEqual(a.clone(), b);
        t.deepEqual(a.clone(), a);
        t.end();
    });

    t.end();
});
