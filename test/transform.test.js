'use strict';

var test = require('tape').test;
var Transform = require('../js/ui/transform.js');
var VertexBuffer = require('../js/geometry/linevertexbuffer.js');

test('transform', function(t) {

    t.test('creates a transform', function(t) {
        var transform = new Transform(256);
        transform.width = 500;
        transform.height = 500;
        t.equal(transform.tileSize, 256);
        t.equal(transform.worldSize, 256);
        t.equal(transform.width, 500);
        t.equal(transform.height, 500);
        t.end();
    });

    t.test('has a default zoom', function(t) {
        var transform = new Transform(256);
        transform.width = 500;
        transform.height = 500;
        t.equal(transform.tileZoom, 0);
        t.equal(transform.tileZoom, transform.zoom);
        t.end();
    });
});

test('vertex buffer', function(t) {
    t.test('is initialized', function(t) {
        var buf = new VertexBuffer();
        t.deepEqual(buf.index, 0);
        t.deepEqual(buf.length, 32768);
        t.end();
    });
});
