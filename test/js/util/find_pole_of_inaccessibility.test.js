'use strict';

var test = require('tap').test;
var Point = require('point-geometry');
var findPoleOfInaccessibility = require('../../../js/util/find_pole_of_inaccessibility');

test('polygon_poi', function(t) {

    var closedRing = [
        new Point(0, 0),
        new Point(10, 10),
        new Point(10, 0),
        new Point(0, 0)
    ];
    var closedRingHole = [
        new Point(2, 1),
        new Point(6, 6),
        new Point(6, 1),
        new Point(2, 1)
    ];
    t.deepEqual(findPoleOfInaccessibility([closedRing], 0.1), new Point(7.0703125, 2.9296875));
    t.deepEqual(findPoleOfInaccessibility([closedRing, closedRingHole], 0.1), new Point(7.96875, 2.03125));

    t.end();
});
