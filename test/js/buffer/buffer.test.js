'use strict';

var test = require('prova');
var Buffer = require('../../../js/data/buffer/buffer');
var Canvas = require('../../../js/util/canvas');

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
        var gl = new Canvas().getWebGLContext();
        t.ok(gl, 'gl context is valid');
        var buf = new Buffer();
        buf.bind(gl);
        buf.bind(gl);
        buf.destroy(gl);
        t.end();
    });

    t.end();
});
