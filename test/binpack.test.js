'use strict';
var test = require('tape').test;
var BinPack = require('../js/text/binpack.js');

test('binpack', function(t) {
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
