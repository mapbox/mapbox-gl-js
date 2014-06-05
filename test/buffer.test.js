/* global process */
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


    if (process.browser) {
        t.test('bind and destroy on context', function(t) {
            var canvas = document.createElement('canvas');
            t.ok(canvas, 'canvas can be created');
            var gl = canvas.getContext("experimental-webgl", {
                antialias: false,
                alpha: true,
                stencil: true,
                depth: false
            });
            t.ok(gl, 'gl context is valid');
            var buf = new Buffer();
            buf.bind(gl);
            buf.destroy(gl);
            t.end();
        });
    }

    t.end();
});
