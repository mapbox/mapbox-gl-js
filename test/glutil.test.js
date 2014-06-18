/* global process */
'use strict';

var test = require('tape').test;

if (process.browser) {
    require('../js/render/glutil.js');

    test('GLUtil', function(t) {
        var WebGLRenderingContext = window.WebGLRenderingContext;
        t.ok(WebGLRenderingContext.prototype.getShader);
        t.ok(WebGLRenderingContext.prototype.initializeShader);

        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('experimental-webgl', {
            antialias: false,
            alpha: true,
            stencil: true,
            depth: false
        });
        t.ok(gl instanceof WebGLRenderingContext);
        t.ok(gl.initializeShader);
        t.end();
    });
}
