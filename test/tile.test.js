'use strict';

var test = require('tape').test;
var Tile = require('../js/ui/tile.js'),
    Point = require('../js/geometry/point.js');

test('tile', function(t) {
    t.test('#positionAt', function(t) {
        t.deepEqual(Tile.positionAt(Tile.toID(0, 0, 0), new Point(0, 0)), null);
        t.end();
    });
    t.test('#toID', function(t) {
        t.test('calculates an iD', function(t) {
            t.deepEqual(Tile.toID(0, 0, 0), 0);
            t.deepEqual(Tile.toID(1, 0, 0), 1);
            t.deepEqual(Tile.toID(1, 1, 0), 33);
            t.deepEqual(Tile.toID(1, 1, 1), 97);
            t.deepEqual(Tile.toID(1, 1, 1, -1), 225);
            t.end();
        });
    });
    t.test('#asString', function(t) {
        t.test('calculates strings', function(t) {
            t.deepEqual(Tile.asString(Tile.toID(1, 1, 1)), '1/1/1');
            t.end();
        });
    });
    t.test('#fromID', function(t) {
        t.test('forms a loop', function(t) {
            t.deepEqual(Tile.fromID(Tile.toID(1, 1, 1)), { z: 1, x: 1, y: 1, w: 0 });
            t.deepEqual(Tile.fromID(0), { z: 0, x: 0, y: 0, w: 0 });
            t.end();
        });
    });
    t.test('#url', function(t) {
        t.equal(Tile.url(1, '{z}/{x}/{y}.json'), '1/0/0.json', 'gets a url');
        t.end();
    });
    t.test('#zoom', function(t) {
        for (var i = 0; i < 20; i++) {
            t.equal(Tile.zoom(Tile.toID(i, 1, 1)), i);
        }
        t.end();
    });
    t.test('#children', function(t) {
        t.deepEqual(Tile.children(Tile.toID(0, 0, 0)),
                    [ 1, 33, 65, 97 ]);
        t.end();
    });
    t.test('#parent', function(t) {
        t.test('returns a parent id', function(t) {
            t.deepEqual(Tile.parent(33), 0);
            t.deepEqual(Tile.parent(32), 32);
            t.end();
        });
    });
    t.test('#parentWithZoom', function(t) {
        t.deepEqual(Tile.parentWithZoom(Tile.toID(10, 10, 10), 0),
                    Tile.toID(0, 0, 0));
        t.deepEqual(Tile.parentWithZoom(Tile.toID(10, 10, 10), 1),
                    Tile.toID(1, 0, 0));
        t.deepEqual(Tile.parentWithZoom(Tile.toID(10, 50, 20), 5),
                    37);
        t.end();
    });
});
