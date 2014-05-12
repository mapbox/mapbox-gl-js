'use strict';

var test = require('tape').test;

var rc = require('../js/text/rotationrange.js');
var Point = require('../js/geometry/point.js');
var PI = Math.PI;

function deg(x) { return x/PI * 180; }

test('#mergeCollisions', function(t) {
    t.deepEqual(rc.mergeCollisions([[3/8*PI, 5/8*PI], [4/8*PI, 6/8*PI], [1/8*PI, 2/8*PI]], [2*PI, 0]), [1/8*PI, 6/8*PI], 'merges overlapping ranges');
    t.deepEqual(rc.mergeCollisions([[PI/2, PI], [5/4*PI, 6/4*PI]], [0, PI]), [5/4*PI, 6/4*PI], 'ignore collision within ignore range');
    t.deepEqual(rc.mergeCollisions([[1/2*PI, PI]], [3/4*PI, 3/2*PI]), [1/2*PI, 3/4*PI], 'crop collision that ends within ignore range');
    t.deepEqual(rc.mergeCollisions([[1/2*PI, PI]], [1/4*PI, 3/4*PI]), [3/4*PI, PI], 'crop collision that starts within ignore range');
    t.end();
});

test('#rotatingFixedCollision', function(t) {
    t.test('returns collisions', function(t) {
        var collisions = rc.rotatingFixedCollisions(
            { x1: -1, x2: 0, y1: 0, y2: 1 },
            { x1: 1.4142, x2: 10, y1: -10, y2: 10 });

        t.equal(collisions.length, 1);
        t.equal(Math.round(deg(collisions[0][0])), 135);
        t.equal(Math.round(deg(collisions[0][1])), 135);
        t.end();
    });
});

test('#cornerBoxCollisions', function(t) {
    t.deepEqual(rc.cornerBoxCollisions(
        new Point(1, 1),
        [new Point(0, 0), new Point(0, 10), new Point(10, 10), new Point(10, 0)]), [[PI/4, PI * 7/4]],
        'returns intersections in sorted order as angles 0..2PI');

    t.deepEqual(rc.cornerBoxCollisions(
        new Point(200, 200),
        [new Point(1, 1), new Point(1, 10), new Point(10, 10), new Point(10, 1)]),
        [],
        'handles no intersections');
    t.end();
});

test('#circleEdgeCollisions', function(t) {
    var c = rc.circleEdgeCollisions(
            new Point(0, 1),
            1,
            new Point(-10, 0), new Point(10, 0));
    c.sort();
    t.deepEqual(c, [Math.PI/2, Math.PI*3/2], 'handles two intersection points');

    t.deepEqual(rc.circleEdgeCollisions(
            new Point(0, 1),
            1,
            new Point(0, 0), new Point(10, 0)),
        [Math.PI/2], 'handles one intersection point');

    t.deepEqual(rc.circleEdgeCollisions(
            new Point(0, 1),
            1,
            new Point(3, 1), new Point(30, 1)), [], 'only returns intersections within the line segment')

    t.deepEqual(rc.circleEdgeCollisions(
            new Point(0, 1),
            1,
            new Point(-10, 1), new Point(10, 1)), [],
            'doesnt count tangetial intersections as collisions');
     t.end();
});

test('#rotatingRotatingCollisions', function(t) {
    t.test('basically works', function(t) {
        var c = rc.rotatingRotatingCollisions(
            { x1: -1, x2: 1, y1: 0, y2: 0 },
            { x1: -1, x2: 1, y1: 0, y2: 0 },
            new Point(1, 1)
        );

        t.equal(Math.round(deg(c[0][0])), 135);
        t.equal(Math.round(deg(c[0][1])), 135);
        t.equal(Math.round(deg(c[1][0])), 315);
        t.equal(Math.round(deg(c[1][1])), 315);
        t.end();
    });

    var c = rc.rotatingRotatingCollisions(
        { x1: -1, x2: 1, y1: 0, y2: 0 },
        { x1: -1, x2: 1, y1: 0, y2: 0 },
        new Point(2, 2)
    );

    t.deepEqual(c, [], 'checks if the two boxes are close enough to collide at that angle');
    t.end();
});
