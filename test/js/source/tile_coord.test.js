'use strict';

var test = require('prova');
var TileCoord = require('../../../js/source/tile_coord');

test('TileCoord', function(t) {
    var sourceMaxZoom = 20;

    t.test('#constructor', function(t) {
        t.ok(new TileCoord(0, 0, 0, 0, sourceMaxZoom) instanceof TileCoord, 'creates an objectw');
        t.throws(function() {
            /*eslint no-new: 0*/
            new TileCoord(-1, 0, 0, 0);
        }, "Invalid TileCoord object: (-1, 0, 0, 0)", 'detects and throws on invalid input');
        t.end();
    });

    t.test('.id', function(t) {
        t.deepEqual(new TileCoord(0, 0, 0, 0, sourceMaxZoom).id, 0);
        t.deepEqual(new TileCoord(1, 0, 0, 0, sourceMaxZoom).id, 1);
        t.deepEqual(new TileCoord(1, 1, 0, 0, sourceMaxZoom).id, 33);
        t.deepEqual(new TileCoord(1, 1, 1, 0, sourceMaxZoom).id, 97);
        t.deepEqual(new TileCoord(1, 1, 1, -1, sourceMaxZoom).id, 225);
        t.end();
    });

    t.test('.toString', function(t) {
        t.test('calculates strings', function(t) {
            t.deepEqual(new TileCoord(1, 1, 1, 0, sourceMaxZoom).toString(), '1/1/1');
            t.end();
        });
    });

    t.test('.fromID', function(t) {
        t.test('forms a loop', function(t) {
            t.deepEqual(TileCoord.fromID(new TileCoord(1, 1, 1, 0, sourceMaxZoom).id, sourceMaxZoom), new TileCoord(1, 1, 1, 0, sourceMaxZoom));
            t.deepEqual(TileCoord.fromID(0, sourceMaxZoom), new TileCoord(0, 0, 0, 0, sourceMaxZoom));
            t.end();
        });
    });

    t.test('.url', function(t) {
        t.equal(new TileCoord(1, 0, 0, 0, sourceMaxZoom).url(['{z}/{x}/{y}.json']), '1/0/0.json', 'gets a url');
        t.end();
    });

    t.test('.children', function(t) {
        t.deepEqual(new TileCoord(0, 0, 0, 0, sourceMaxZoom).children(),
            [ 1, 33, 65, 97 ].map(function(id) { return TileCoord.fromID(id, sourceMaxZoom); }));
        t.deepEqual(new TileCoord(4, 0, 0, 0, 4).children(), [ new TileCoord(5, 0, 0, 0, 4) ]);
        t.deepEqual(new TileCoord(6, 0, 0, 0, 4).children(), [ new TileCoord(7, 0, 0, 0, 4) ]);
        t.end();
    });

    t.test('.parent', function(t) {
        t.test('returns a parent id', function(t) {
            t.equal(TileCoord.fromID(33, sourceMaxZoom).parent().id, 0);
            t.end();
        });

        t.test('returns null for z0', function(t) {
            t.equal(TileCoord.fromID(0, sourceMaxZoom).parent(), null);
            t.equal(TileCoord.fromID(32, sourceMaxZoom).parent(), null);
            t.end();
        });

        t.test('returns correct parent when z > sourceMaxZoom', function(t) {
            t.deepEqual(new TileCoord(sourceMaxZoom + 1, 8, 8, 0, sourceMaxZoom).parent(), new TileCoord(sourceMaxZoom, 8, 8, 0, sourceMaxZoom));
            t.end();
        });
    });

});
