'use strict';

var test = require('tap').test;
var Anchor = require('../../../js/symbol/anchor');

test('Anchor', function(t) {
    t.test('#constructor', function(t) {
        t.ok(new Anchor(0, 0, 0, []) instanceof Anchor, 'creates an object');
        t.ok(new Anchor(0, 0, 0, [], []) instanceof Anchor, 'creates an object with a segment');
        t.end();
    });
    t.test('#clone', function(t) {
        var a = new Anchor(1, 2, 3, []);
        var b = new Anchor(1, 2, 3, []);
        t.deepEqual(a.clone(), b);
        t.deepEqual(a.clone(), a);
        t.end();
    });

    t.end();
});
