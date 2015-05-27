'use strict';

var test = require('prova');
var LatLng = require('../../../js/geo/lat_lng');

test('LatLng', function(t) {
    t.test('#constructor', function(t) {
        t.ok(new LatLng(0, 0) instanceof LatLng, 'creates an object');
        t.throws(function() {
            /*eslint no-new: 0*/
            new LatLng('foo', 0);
        }, "Invalid LatLng object: (foo, 0)", 'detects and throws on invalid input');
        t.end();
    });
    t.test('#convert', function(t) {
        t.ok(LatLng.convert([0, 10]) instanceof LatLng, 'convert creates a LatLng instance');
        t.ok(LatLng.convert(new LatLng(0, 0)) instanceof LatLng, 'convert creates a LatLng instance');
        t.equal(LatLng.convert('othervalue'), 'othervalue', 'passes through other values');
        t.end();
    });
});
