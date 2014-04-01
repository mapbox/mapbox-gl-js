'use strict';

var test = require('tape').test;
var Tile = require('../js/ui/tile.js');

test('tile', function(t) {
    t.test('#toID', function(t) {
        t.test('calculates an iD', function(t) {
            t.deepEqual(Tile.toID(0, 0, 0), 0);
            t.deepEqual(Tile.toID(1, 0, 0), 1);
            t.deepEqual(Tile.toID(1, 1, 0), 33);
            t.deepEqual(Tile.toID(1, 1, 1), 97);
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
        t.equal(Tile.url(1, ['{z}/{x}/{y}.json']), '1/0/0.json', 'gets a url');
        t.end();
    });
    t.test('#parent', function(t) {
        t.test('returns a parent id', function(t) {
            t.deepEqual(Tile.parent(33), 0);
            t.deepEqual(Tile.parent(32), 32);
            t.end();
        });
    });
});
