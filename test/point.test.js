var expect = require('expect.js');

var Point = require('../js/geometry/point.js');

describe('Point', function() {
    describe('vector operations', function() {
        describe('#mag', function() {
            it('gets the magnitude of a vector', function() {
                expect(new Point(0, 2).mag()).to.eql(2);
                expect(new Point(0, 0).mag()).to.eql(0);
                expect(new Point(10, 0).mag()).to.eql(10);
            });
        });
        describe('#unit', function() {
            it('calculates the unit vector', function() {
                expect(new Point(0, 1000).unit()).to.eql(new Point(0, 1));
            });
        });
        describe('#perp', function() {
            it('calculates a vector perpendicular to the given vector', function() {
                expect(new Point(0, 1000).perp()).to.eql(new Point(-1000, 0));
            });
        });
        describe('#add', function() {
            it('adds two vectors', function() {
                expect(new Point(0, 0).add(new Point(10, 10)))
                    .to.eql(new Point(10, 10));
            });
        });
        describe('#sub', function() {
            it('adds subtracts a vector from another', function() {
                expect(new Point(0, 0).sub(new Point(10, 10)))
                    .to.eql(new Point(-10, -10));
            });
        });
    });
});
