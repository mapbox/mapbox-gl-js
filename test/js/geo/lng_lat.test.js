'use strict';

var test = require('tap').test;
var LngLat = require('../../../js/geo/lng_lat');

test('LngLat', function(t) {
    t.test('#constructor', function(t) {
        t.ok(new LngLat(0, 0) instanceof LngLat, 'creates an object');
        t.throws(function() {
            /*eslint no-new: 0*/
            new LngLat('foo', 0);
        }, "Invalid LngLat object: (foo, 0)", 'detects and throws on invalid input');
        t.throws(function() {
            /*eslint no-new: 0*/
            new LngLat(0, -91);
        }, 'Invalid LngLat latitude value: must be between -90 and 90', 'detects and throws on invalid input');
        t.throws(function() {
            /*eslint no-new: 0*/
            new LngLat(0, 91);
        }, 'Invalid LngLat latitude value: must be between -90 and 90', 'detects and throws on invalid input');
        t.end();
    });

    t.test('#convert', function(t) {
        t.ok(LngLat.convert([0, 10]) instanceof LngLat, 'convert creates a LngLat instance');
        t.ok(LngLat.convert(new LngLat(0, 0)) instanceof LngLat, 'convert creates a LngLat instance');
        t.equal(LngLat.convert('othervalue'), 'othervalue', 'passes through other values');
        t.end();
    });

    t.test('#wrap', function(t) {
        t.deepEqual(new LngLat(0, 0).wrap(), { lng: 0, lat: 0 });
        t.deepEqual(new LngLat(10, 20).wrap(), { lng: 10, lat: 20 });
        t.deepEqual(new LngLat(360, 0).wrap(), { lng: 0, lat: 0 });
        t.deepEqual(new LngLat(190, 0).wrap(), { lng: -170, lat: 0 });
        t.end();
    });

    t.test('#toArray', function(t) {
        t.deepEqual(new LngLat(10, 20).toArray(), [10, 20]);
        t.end();
    });

    t.test('#toString', function(t) {
        t.equal(new LngLat(10, 20).toString(), 'LngLat(10, 20)');
        t.end();
    });

    t.end();
});
