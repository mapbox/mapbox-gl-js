'use strict';

var test = require('tape').test,
    interpolate = require('../../../js/geometry/interpolate.js'),
    Point = require('point-geometry');

test('Interpolate', function(t) {
    var points = [];
    for (var i = 0; i < 3; i++) {
        points.push(new Point(0, i));
    }
    t.deepEqual(interpolate(points, 10, 0.5, 16, 8), []);
    t.deepEqual(interpolate(points, 0.5, 0.5, 16, 8), [
        { angle: 1.5707963267948966, scale: 0.5, segment: 0, x: 0, y: 0.5 },
        { angle: 1.5707963267948966, scale: 8, segment: 1, x: 0, y: 1 },
        { angle: 1.5707963267948966, scale: 4, segment: 1, x: 0, y: 1.5 }
    ]);
    t.deepEqual(interpolate(points, 0.5, 0.5, 8, 8), [
        { angle: 1.5707963267948966, scale: 0.5, segment: 1, x: 0, y: 1 },
    ]);
    t.end();
});
