'use strict';
var test = require('tape').test;

var Buffer = require('../js/geometry/buffer.js');

test('Buffer', function(t) {
    t.ok(new Buffer(), 'default buffer');
    var b = new Buffer();
    t.ok(new Buffer(b), 'buffer from another instance');

    t.equal(b.length, 8192);
    t.equal(b.resize(), undefined);
    b.pos = b.defaultLength;
    t.equal(b.resize(), undefined);
    t.equal(b.length, 12288);
    t.end();
});
