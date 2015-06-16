'use strict';

var test = require('prova');
var TileCoord = require('../../../js/source/tile_coord');

test('TileCoord', function(t) {
    t.test('.id', function(t) {
        t.deepEqual(new TileCoord(0, 0, 0).id, 0);
        t.deepEqual(new TileCoord(1, 0, 0).id, 1);
        t.deepEqual(new TileCoord(1, 1, 0).id, 33);
        t.deepEqual(new TileCoord(1, 1, 1).id, 97);
        t.deepEqual(new TileCoord(1, 1, 1, -1).id, 225);
        t.end();
    });

    t.test('.toString', function(t) {
        t.test('calculates strings', function(t) {
            t.deepEqual(new TileCoord(1, 1, 1).toString(), '1/1/1');
            t.end();
        });
    });

    t.test('.fromID', function(t) {
        t.test('forms a loop', function(t) {
            t.deepEqual(TileCoord.fromID(new TileCoord(1, 1, 1).id), new TileCoord(1, 1, 1));
            t.deepEqual(TileCoord.fromID(0), new TileCoord(0, 0, 0, 0));
            t.end();
        });
    });

    t.test('.url', function(t) {
        t.equal(new TileCoord(1, 0, 0).url(['{z}/{x}/{y}.json']), '1/0/0.json', 'gets a url');
        t.end();
    });

    t.test('.children', function(t) {
        t.deepEqual(new TileCoord(0, 0, 0).children(),
            [ 1, 33, 65, 97 ].map(TileCoord.fromID));
        t.end();
    });

    t.test('.parent', function(t) {
        t.test('returns a parent id', function(t) {
            t.equal(TileCoord.fromID(33).parent().id, 0);
            t.end();
        });

        t.test('returns null for z0', function(t) {
            t.equal(TileCoord.fromID(0).parent(), null);
            t.equal(TileCoord.fromID(32).parent(), null);
            t.end();
        });
    });

});
