'use strict';

var test = require('tape');

require('../../bootstrap');

var Buffer = require('../../../js/data/buffer/buffer');

test('Buffer', function(t) {
    t.ok(new Buffer(), 'default buffer');
    var b = new Buffer();
    t.ok(new Buffer(b), 'buffer from another instance');

    t.equal(b.length, 8192);
    t.equal(b.resize(), undefined);
    b.pos = b.defaultLength;
    t.equal(b.resize(), undefined);
    t.equal(b.length, 12288);

    t.test('bind and destroy on context', function(t) {
        var gl = require('./../../gl')();
        t.ok(gl, 'gl context is valid');
        var buf = new Buffer();
        buf.bind(gl);
        buf.bind(gl);
        buf.destroy(gl);
        t.end();
    });

    t.end();
});
