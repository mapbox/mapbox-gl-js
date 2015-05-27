'use strict';

var test = require('prova');
var BinPack = require('../../../js/symbol/bin_pack');

test('binpack', function(t) {
    t.test('large square', function(t) {
        var bp = new BinPack(800, 800);
        t.deepEqual(bp.allocate(10, 10), {
            x: 0,
            y: 0,
            w: 10,
            h: 10
        }, 'packs a 10x10 square');
        t.deepEqual(bp.allocate(10, 10), {
            x: 10,
            y: 0,
            w: 10,
            h: 10
        }, 'packs a 10x10 square');
        t.deepEqual(bp.allocate(10, 10), {
            x: 0,
            y: 10,
            w: 10,
            h: 10
        }, 'packs a 10x10 square');
        t.end();
    });
    t.test('release single', function(t) {
        var bp = new BinPack(10, 10);
        var allocated = bp.allocate(10, 10);
        var expected = {
            x: 0,
            y: 0,
            w: 10,
            h: 10
        };
        t.deepEqual(allocated, expected, 'packs a 10x10 square');
        t.deepEqual(bp.allocate(10, 10), {
            x: -1,
            y: -1
        }, 'cannot pack another');
        var freed = bp.release(allocated);
        t.deepEqual(freed, undefined, 'releases a 10x10 square');
        t.end();
    });
    t.test('release many in same order', function(t) {
        var bp = new BinPack(100, 100);
        var allocated = [];
        for (var i = 0; i < 20; i++) {
            allocated.push(bp.allocate(10, 10));
        }
        for (i = 19; i >= 0; i--) {
            bp.release(allocated[i]);
        }
        allocated = bp.allocate(10, 10);
        var expected = {
            x: 0,
            y: 0,
            w: 10,
            h: 10
        };
        t.deepEqual(allocated, expected, 'packs a 10x10 square');
        t.end();
    });
    t.test('release many in reverse order', function(t) {
        var bp = new BinPack(100, 100);
        var allocated = [];
        for (var i = 0; i < 20; i++) {
            allocated.push(bp.allocate(10, 10));
        }
        for (i = 0; i < 20; i++) {
            bp.release(allocated[i]);
        }
        allocated = bp.allocate(10, 10);
        var expected = {
            x: 0,
            y: 0,
            w: 10,
            h: 10
        };
        t.deepEqual(allocated, expected, 'packs a 10x10 square');
        t.end();
    });
    t.test('not enough room', function(t) {
        var bp = new BinPack(10, 10);
        t.deepEqual(bp.allocate(10, 10), {
            x: 0,
            y: 0,
            w: 10,
            h: 10
        }, 'packs a 10x10 square');
        t.deepEqual(bp.allocate(10, 10), {
            x: -1,
            y: -1
        }, 'not enough room');
        t.end();
    });
    t.end();
});
