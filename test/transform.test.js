'use strict';

var test = require('tape').test;
var Transform = require('../js/ui/transform.js');
var Point = require('point-geometry');
var LatLng = require('../js/geometry/latlng.js');
var VertexBuffer = require('../js/geometry/linevertexbuffer.js');

test('transform', function(t) {

    t.test('creates a transform', function(t) {
        var transform = new Transform(256);
        transform.width = 500;
        transform.height = 500;
        t.equal(transform.tileSize, 256);
        t.equal(transform.worldSize, 256);
        t.equal(transform.width, 500);
        t.equal(transform.minZoom, 0);
        t.equal(transform.minZoom = 10, 10);
        t.equal(transform.maxZoom = 10, 10);
        t.equal(transform.minZoom, 10);
        t.deepEqual(transform.center, { lat: 0, lng: 0 });
        t.equal(transform.maxZoom, 10);
        t.equal(transform.size.equals(new Point(500, 500)), true);
        t.equal(transform.centerPoint.equals(new Point(250, 250)), true);
        t.equal(transform.scaleZoom(0), -Infinity);
        t.equal(transform.scaleZoom(10), 3.3219280948873626);
        t.deepEqual(transform.point, new Point(131072, 131072));
        t.equal(transform.x, 131072);
        t.equal(transform.y, 131072);
        t.equal(transform.height, 500);
        t.deepEqual(transform.pointLocation(new Point(250, 250)), { lat: 0, lng: 0 });
        t.deepEqual(transform.pointCoordinate(
            transform.locationCoordinate(new LatLng(0, 0)), new Point(250, 250)),
            { column: 512, row: 512, zoom: 10 });
        t.deepEqual(transform.locationPoint(new LatLng(0, 0)), { x: 250, y: 250 });
        t.deepEqual(transform.locationCoordinate(new LatLng(0, 0)), { column: 512, row: 512, zoom: 10 });
        t.end();
    });

    t.test('panBy', function(t) {
        var transform = new Transform(256);
        transform.width = 500;
        transform.height = 500;
        t.deepEqual(transform.center, { lat: 0, lng: 0 });
        t.equal(transform.panBy(new Point(10, 10)), undefined);
        t.deepEqual(transform.center, { lat: -13.923403897723333, lng: 14.0625 });
        t.end();
    });

    t.test('zoomAroundTo', function(t) {
        var transform = new Transform(256);
        transform.width = 500;
        transform.height = 500;
        t.deepEqual(transform.center, { lat: 0, lng: 0 });
        t.equal(transform.zoom, 0);
        t.equal(transform.zoomAroundTo(10, new Point(10, 10)), undefined);
        t.equal(transform.zoom, 10);
        t.deepEqual(transform.center, { lat: 89.68125447792221, lng: -337.17041015625 });
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
