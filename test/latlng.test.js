'use strict';

var expect = require('expect.js');

var LatLng = require('../js/geometry/latlng.js');

describe('LatLng', function() {
    describe('#constructor', function() {
        it('creates an object', function() {
            expect(new LatLng(0, 0) instanceof LatLng).to.be.true;
        });
        it('detects and throws on invalid input', function() {
            expect(function() {
                new LatLng('foo', 0);
            }).to.throwException("Invalid LatLng object: (foo, 0)");
        });
    });
    describe('#convert', function() {
        it('converts arrays into objects', function() {
            expect(LatLng.convert([0, 10]) instanceof LatLng).to.be.true;
        });
    });
});
