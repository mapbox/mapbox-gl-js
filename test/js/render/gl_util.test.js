'use strict';

var test = require('prova');
var createContext = require('./../../gl');
var glutil = require('../../../js/render/gl_util');

test('GLUtil', function(t) {
    t.test('extend', function(t) {
        var gl = glutil.extend(createContext());
        t.ok(gl.getShader);
        t.ok(gl.initializeShader);
        t.ok(gl.switchShader);
        t.end();
    });
});
