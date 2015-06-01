'use strict';

var test = require('prova');
var extentBufferCache = require('../../../js/render/extent_buffer_cache');

test('getDebugBuffer', function(t) {
    var b1024 = extentBufferCache.getDebugBuffer(1024);
    t.ok(b1024);
    var c1024 = extentBufferCache.getDebugBuffer(1024);
    t.equal(b1024, c1024);
    var b2048 = extentBufferCache.getDebugBuffer(2048);
    t.notEqual(b1024, b2048);
    t.end();
});

test('getTileExtentBuffer', function(t) {
    var b1024 = extentBufferCache.getTileExtentBuffer(1024);
    t.ok(b1024);
    var c1024 = extentBufferCache.getTileExtentBuffer(1024);
    t.equal(b1024, c1024);
    var b2048 = extentBufferCache.getTileExtentBuffer(2048);
    t.notEqual(b1024, b2048);
    t.end();
});
