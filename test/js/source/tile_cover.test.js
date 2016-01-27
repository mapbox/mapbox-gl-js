'use strict';

var test = require('prova');
var TileCoord = require('../../../js/source/tile_coord');
var tileCover = require('../../../js/source/tile_cover');

test('tileCover', function(t) {
    var sourceMaxZoom = 20;

    t.test('calculates tile coverage at w = 0', function(t) {
        var z = 2,
            coords = [
                {column: 0, row: 1, zoom: 2},
                {column: 1, row: 1, zoom: 2},
                {column: 1, row: 2, zoom: 2},
                {column: 0, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, sourceMaxZoom, false);
        t.deepEqual(res, [new TileCoord(2, 0, 1, 0, sourceMaxZoom)]);
        t.end();
    });

    t.test('calculates tile coverage at w > 0', function(t) {
        var z = 2,
            coords = [
                {column: 12, row: 1, zoom: 2},
                {column: 13, row: 1, zoom: 2},
                {column: 13, row: 2, zoom: 2},
                {column: 12, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, sourceMaxZoom, false);
        t.deepEqual(res, [new TileCoord(2, 0, 1, 3, sourceMaxZoom)]);
        t.end();
    });

    t.test('calculates tile coverage at w = -1', function(t) {
        var z = 2,
            coords = [
                {column: -1, row: 1, zoom: 2},
                {column:  0, row: 1, zoom: 2},
                {column:  0, row: 2, zoom: 2},
                {column: -1, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, sourceMaxZoom, false);
        t.deepEqual(res, [new TileCoord(2, 3, 1, -1, sourceMaxZoom)]);
        t.end();
    });

    t.test('calculates tile coverage at w < -1', function(t) {
        var z = 2,
            coords = [
                {column: -13, row: 1, zoom: 2},
                {column: -12, row: 1, zoom: 2},
                {column: -12, row: 2, zoom: 2},
                {column: -13, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, sourceMaxZoom, false);
        t.deepEqual(res, [new TileCoord(2, 3, 1, -4, sourceMaxZoom)]);
        t.end();
    });

    t.test('calculates tile coverage across meridian', function(t) {
        var z = 2,
            coords = [
                {column: -0.5, row: 1, zoom: 2},
                {column:  0.5, row: 1, zoom: 2},
                {column:  0.5, row: 2, zoom: 2},
                {column: -0.5, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, sourceMaxZoom, false);
        t.deepEqual(res, [new TileCoord(2, 0, 1, 0, sourceMaxZoom), new TileCoord(2, 3, 1, -1, sourceMaxZoom)]);
        t.end();
    });

    t.test('calculated coverage when past sourceMaxZoom', function(t) {
        var z = 5,
            coords = [
                {column: 0, row: 1, zoom: 2},
                {column: 1, row: 1, zoom: 2},
                {column: 1, row: 2, zoom: 2},
                {column: 0, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, 2, false);
        t.deepEqual(res, [new TileCoord(2, 0, 1, 0, 2)]);
        t.end();
    });

    t.test('calculated coverage for overscaled tiles', function(t) {
        var z = 5,
            coords = [
                {column: 0, row: 1, zoom: 2},
                {column: 1, row: 1, zoom: 2},
                {column: 1, row: 2, zoom: 2},
                {column: 0, row: 2, zoom: 2}
            ],
            res = tileCover(z, coords, 2, true);
        t.deepEqual(res, [new TileCoord(5, 0, 1, 0, 2)]);
        t.end();
    });


});
