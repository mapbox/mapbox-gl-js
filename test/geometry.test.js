'use strict';
var test = require('tape').test;

var Geometry = require('../js/geometry/geometry.js'),
    Point = require('../js/geometry/point.js');

test('Geometry', function(t) {
    var geom = new Geometry();
    t.ok(geom);

    t.equal(geom.bufferList().length, 6);

    var pointWithScale = new Point(0, 0);
    pointWithScale.scale = 10;

    t.equal(geom.addPoints([
        new Point(0, 0),
        new Point(10, 10),
        pointWithScale
    ]), undefined);

    t.equal(geom.addPoints([
        new Point(0, 0),
        new Point(10, 10)
    ], {
        zoom: 0,
        scale: 0,
        rotationRange: [0, 0]
    }), undefined);

    t.equal(geom.addFill([
        new Point(0, 0),
        new Point(10, 10)
    ]), undefined);

    t.equal(geom.addFill([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]), undefined);

    // should throw in the future?
    t.equal(geom.addLine([
        new Point(0, 0)
    ]), undefined);

    // should also throw in the future?
    // this is a closed single-segment line
    t.equal(geom.addLine([
        new Point(0, 0),
        new Point(0, 0)
    ]), undefined);

    t.equal(geom.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20)
    ]), undefined);

    t.equal(geom.addLine([
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 20),
        new Point(0, 0)
    ]), undefined);

    t.end();
});
