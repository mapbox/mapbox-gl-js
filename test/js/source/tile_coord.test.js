'use strict';

var test = require('tape');
var TileCoord = require('../../../js/source/tile_coord');

test('TileCoord', function(t) {
    t.test('.toID', function(t) {
        t.test('calculates an iD', function(t) {
            t.deepEqual(TileCoord.toID(0, 0, 0), 0);
            t.deepEqual(TileCoord.toID(1, 0, 0), 1);
            t.deepEqual(TileCoord.toID(1, 1, 0), 33);
            t.deepEqual(TileCoord.toID(1, 1, 1), 97);
            t.deepEqual(TileCoord.toID(1, 1, 1, -1), 225);
            t.end();
        });
    });

    t.test('.asString', function(t) {
        t.test('calculates strings', function(t) {
            t.deepEqual(TileCoord.asString(TileCoord.toID(1, 1, 1)), '1/1/1');
            t.end();
        });
    });

    t.test('.fromID', function(t) {
        t.test('forms a loop', function(t) {
            t.deepEqual(TileCoord.fromID(TileCoord.toID(1, 1, 1)), { z: 1, x: 1, y: 1, w: 0 });
            t.deepEqual(TileCoord.fromID(0), { z: 0, x: 0, y: 0, w: 0 });
            t.end();
        });
    });

    t.test('.url', function(t) {
        t.equal(TileCoord.url(1, ['{z}/{x}/{y}.json']), '1/0/0.json', 'gets a url');
        t.end();
    });

    t.test('.zoom', function(t) {
        for (var i = 0; i < 20; i++) {
            t.equal(TileCoord.zoom(TileCoord.toID(i, 1, 1)), i);
        }
        t.end();
    });

    t.test('.children', function(t) {
        t.deepEqual(TileCoord.children(TileCoord.toID(0, 0, 0)),
                    [ 1, 33, 65, 97 ]);
        t.end();
    });

    t.test('.parent', function(t) {
        t.test('returns a parent id', function(t) {
            t.equal(TileCoord.parent(33), 0);
            t.end();
        });

        t.test('returns null for z0', function(t) {
            t.equal(TileCoord.parent(0), null);
            t.equal(TileCoord.parent(32), null);
            t.end();
        });
    });

    t.test('.parentWithZoom', function(t) {
        t.deepEqual(TileCoord.parentWithZoom(TileCoord.toID(10, 10, 10), 0),
                    TileCoord.toID(0, 0, 0));
        t.deepEqual(TileCoord.parentWithZoom(TileCoord.toID(10, 10, 10), 1),
                    TileCoord.toID(1, 0, 0));
        t.deepEqual(TileCoord.parentWithZoom(TileCoord.toID(10, 50, 20), 5),
                    37);
        t.end();
    });

    test('.zoomTo', function(t) {
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

        t.deepEqual(TileCoord.zoomTo(coord, 8), zoomed, 'zoomTo');
        t.deepEqual(coord, zoomed, 'changed by reference');

        t.end();
    });
});
