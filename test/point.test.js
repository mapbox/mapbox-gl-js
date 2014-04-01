var test = require('tape').test;

var Point = require('../js/geometry/point.js');

test('Point', function(t) {
    t.test('vector operations', function(t) {
        t.test('#mag', function(t) {
            t.test('gets the magnitude of a vector', function() {
                t.equal(new Point(0, 2).mag(), 2);
                t.equal(new Point(0, 0).mag(), 0);
                t.equal(new Point(10, 0).mag(), 10);
                t.end();
            });
        });
        t.test('#unit', function(t) {
            t.test('calculates the unit vector', function() {
                t.deepEqual(new Point(0, 1000).unit(), new Point(0, 1));
                t.end();
            });
        });
        t.test('#perp', function(t) {
            t.test('calculates a vector perpendicular to the given vector', function() {
                t.deepEqual(new Point(0, 1000).perp(), new Point(-1000, 0));
                t.end();
            });
        });
        t.test('#add', function(t) {
            t.test('adds two vectors', function() {
                t.deepEqual(new Point(0, 0).add(new Point(10, 10)), new Point(10, 10));
                t.end();
            });
        });
        t.test('#sub', function(t) {
            t.test('adds subtracts a vector from another', function() {
                t.deepEqual(new Point(0, 0).sub(new Point(10, 10)), new Point(-10, -10));
                t.end();
            });
        });
    });
});
