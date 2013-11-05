var expect = require('expect.js');

var util = require('../js/util.js');

describe('util', function() {
    /* These utils require the DOM api

    describe('#frame', function() {
        it('grabs a frame', function(done) {
            util.frame(function() {
                done();
            });
        });
    });
    describe('#timed', function() {
        it('does a simple ramp over time', function(done) {
            var n = -1;
            util.timed(function(t) {
                expect(t > n).to.eql(true);
                n = t;
                if (t == 1) done();
            }, 100);
        });
    });
    */
    describe('vector operations', function() {
        describe('#vectorMag', function() {
            it('gets the magnitude of a vector', function() {
                expect(util.vectorMag({ x: 0, y: 2 })).to.eql(2);
                expect(util.vectorMag({ x: 0, y: 0 })).to.eql(0);
                expect(util.vectorMag({ x: 10, y: 0 })).to.eql(10);
            });
        });
        describe('#normal', function() {
            it('computes a normal vector', function() {
                expect(util.normal({ x: 0, y: 0}, { x: 0, y: 1000 }))
                    .to.eql({ x: 0, y: 1 });
            });
        });
        describe('#vectorAdd', function() {
            it('adds two vectors', function() {
                expect(util.vectorAdd({ x: 0, y: 0 }, { x: 10, y: 10 }))
                    .to.eql({ x: 10, y: 10 });
            });
        });
        describe('#vectorSub', function() {
            it('adds subtracts a vector from another', function() {
                expect(util.vectorSub({ x: 0, y: 0 }, { x: 10, y: 10 }))
                    .to.eql({ x: -10, y: -10 });
            });
        });
    });
});
