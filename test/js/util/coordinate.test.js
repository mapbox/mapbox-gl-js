'use strict';

var test = require('tape').test;
var Coordinate = require('../../../js/util/coordinate.js');

test('coordinate', function(t) {
    var coord = {
        column: 1,
        row: 1,
        zoom: 2
    };
    var zoomed = {
        column: 64,
        row: 64,
        zoom: 8
    };
    var fuzzy = {
        column: 0.5,
        row: 0.5,
        zoom: 0
    };

    t.deepEqual(Coordinate.zoomTo(coord, 8), zoomed, 'zoomTo');
    t.deepEqual(coord, {
        column: 1,
        row: 1,
        zoom: 2
    }, 'unaltered');

    t.deepEqual(Coordinate.zoomTo(coord, 8), zoomed, 'zoomTo');
    t.deepEqual(coord, zoomed, 'changed by reference');

    t.end();
});
