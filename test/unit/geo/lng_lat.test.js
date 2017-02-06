'use strict';

const test = require('mapbox-gl-js-test').test;
const LngLat = require('../../../src/geo/lng_lat');

test('LngLat', (t) => {
    t.test('#constructor', (t) => {
        t.ok(new LngLat(0, 0) instanceof LngLat, 'creates an object');
        t.throws(() => {
            /*eslint no-new: 0*/
            new LngLat('foo', 0);
        }, "Invalid LngLat object: (foo, 0)", 'detects and throws on invalid input');
        t.throws(() => {
            /*eslint no-new: 0*/
            new LngLat(0, -91);
        }, 'Invalid LngLat latitude value: must be between -90 and 90', 'detects and throws on invalid input');
        t.throws(() => {
            /*eslint no-new: 0*/
            new LngLat(0, 91);
        }, 'Invalid LngLat latitude value: must be between -90 and 90', 'detects and throws on invalid input');
        t.end();
    });

    t.test('#convert', (t) => {
        t.ok(LngLat.convert([0, 10]) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lng: 0, lat: 10}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert({lng: 0, lat: 0}) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert(new LngLat(0, 0)) instanceof LngLat, 'convert creates a LngLat instance');
        t.throws(() => {
            LngLat.convert(0, 10);
        }, "`LngLatLike` argument must be specified as a LngLat instance, an object {lng: <lng>, lat: <lat>}, or an array of [<lng>, <lat>]", 'detects and throws on invalid input');
        t.end();
    });

    t.test('#wrap', (t) => {
        t.deepEqual(new LngLat(0, 0).wrap(), { lng: 0, lat: 0 });
        t.deepEqual(new LngLat(10, 20).wrap(), { lng: 10, lat: 20 });
        t.deepEqual(new LngLat(360, 0).wrap(), { lng: 0, lat: 0 });
        t.deepEqual(new LngLat(190, 0).wrap(), { lng: -170, lat: 0 });
        t.end();
    });

    t.test('#toArray', (t) => {
        t.deepEqual(new LngLat(10, 20).toArray(), [10, 20]);
        t.end();
    });

    t.test('#toString', (t) => {
        t.equal(new LngLat(10, 20).toString(), 'LngLat(10, 20)');
        t.end();
    });

    t.end();
});
