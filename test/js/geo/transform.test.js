'use strict';

var test = require('mapbox-gl-js-test').test;
var Point = require('point-geometry');
var Transform = require('../../../js/geo/transform');
var TileCoord = require('../../../js/source/tile_coord');
var LngLat = require('../../../js/geo/lng_lat');

var fixed = require('../../testutil/fixed');
var fixedLngLat = fixed.LngLat;
var fixedCoord = fixed.Coord;

test('transform', function(t) {

    t.test('creates a transform', function(t) {
        var transform = new Transform();
        transform.resize(500, 500);
        t.equal(transform.unmodified, true);
        t.equal(transform.tileSize, 512, 'tileSize');
        t.equal(transform.worldSize, 512, 'worldSize');
        t.equal(transform.width, 500, 'width');
        t.equal(transform.minZoom, 0, 'minZoom');
        t.equal(transform.bearing, 0, 'bearing');
        t.equal(transform.bearing = 1, 1, 'set bearing');
        t.equal(transform.bearing, 1, 'bearing');
        t.equal(transform.bearing = 0, 0, 'set bearing');
        t.equal(transform.unmodified, false);
        t.equal(transform.minZoom = 10, 10);
        t.equal(transform.maxZoom = 10, 10);
        t.equal(transform.minZoom, 10);
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        t.equal(transform.maxZoom, 10);
        t.equal(transform.size.equals(new Point(500, 500)), true);
        t.equal(transform.centerPoint.equals(new Point(250, 250)), true);
        t.equal(transform.scaleZoom(0), -Infinity);
        t.equal(transform.scaleZoom(10), 3.3219280948873626);
        t.deepEqual(transform.point, new Point(262144, 262144));
        t.equal(transform.x, 262144);
        t.equal(transform.y, 262144);
        t.equal(transform.height, 500);
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(250, 250))), { lng: 0, lat: 0 });
        t.deepEqual(fixedCoord(transform.pointCoordinate(new Point(250, 250))), { column: 512, row: 512, zoom: 10 });
        t.deepEqual(transform.locationPoint(new LngLat(0, 0)), { x: 250, y: 250 });
        t.deepEqual(transform.locationCoordinate(new LngLat(0, 0)), { column: 512, row: 512, zoom: 10 });
        t.end();
    });

    t.test('panBy', function(t) {
        var transform = new Transform();
        transform.resize(500, 500);
        transform.latRange = undefined;
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        t.equal(transform.panBy(new Point(10, 10)), undefined);
        t.deepEqual(fixedLngLat(transform.center), fixedLngLat({ lng: 7.03125, lat: -7.01366792756663 }));
        t.end();
    });

    t.test('setLocationAt', function(t) {
        var transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        transform.setLocationAtPoint({ lng: 13, lat: 10 }, new Point(15, 45));
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(15, 45))), { lng: 13, lat: 10 });
        t.end();
    });

    t.test('setLocationAt tilted', function(t) {
        var transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        transform.pitch = 50;
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        transform.setLocationAtPoint({ lng: 13, lat: 10 }, new Point(15, 45));
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(15, 45))), { lng: 13, lat: 10 });
        t.end();
    });

    t.test('has a default zoom', function(t) {
        var transform = new Transform();
        transform.resize(500, 500);
        t.equal(transform.tileZoom, 0);
        t.equal(transform.tileZoom, transform.zoom);
        t.end();
    });

    t.test('lngRange & latRange constrain zoom and center', function(t) {
        var transform = new Transform();
        transform.center = new LngLat(0, 0);
        transform.zoom = 10;
        transform.resize(500, 500);

        transform.lngRange = [-5, 5];
        transform.latRange = [-5, 5];

        transform.zoom = 0;
        t.equal(transform.zoom, 5.135709286104402);

        transform.center = new LngLat(-50, -30);
        t.same(transform.center, new LngLat(0, -0.006358305286099153));

        transform.zoom = 10;
        transform.center = new LngLat(-50, -30);
        t.same(transform.center, new LngLat(-4.828338623046875, -4.828969771321582));

        t.end();
    });

    test('coveringTiles', function(t) {
        var options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        var transform = new Transform();
        transform.resize(200, 200);

        transform.zoom = 0;
        t.deepEqual(transform.coveringTiles(options), []);

        transform.zoom = 1;
        t.deepEqual(transform.coveringTiles(options), ['1', '33', '65', '97'].map(TileCoord.fromID));

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringTiles(options), ['162', '194', '290', '322'].map(TileCoord.fromID));

        transform.zoom = 10;
        t.deepEqual(transform.coveringTiles(options), ['16760810', '16760842', '16793578', '16793610'].map(TileCoord.fromID));

        transform.zoom = 11;
        t.deepEqual(transform.coveringTiles(options), ['16760810', '16760842', '16793578', '16793610'].map(TileCoord.fromID));

        t.end();
    });

    test('coveringZoomLevel', function(t) {
        var options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        var transform = new Transform();

        transform.zoom = 0;
        t.deepEqual(transform.coveringZoomLevel(options), 0);

        transform.zoom = 0.1;
        t.deepEqual(transform.coveringZoomLevel(options), 0);

        transform.zoom = 1;
        t.deepEqual(transform.coveringZoomLevel(options), 1);

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringZoomLevel(options), 2);

        transform.zoom = 10;
        t.deepEqual(transform.coveringZoomLevel(options), 10);

        transform.zoom = 11;
        t.deepEqual(transform.coveringZoomLevel(options), 11);

        transform.zoom = 11.5;
        t.deepEqual(transform.coveringZoomLevel(options), 11);

        options.tileSize = 256;

        transform.zoom = 0;
        t.deepEqual(transform.coveringZoomLevel(options), 1);

        transform.zoom = 0.1;
        t.deepEqual(transform.coveringZoomLevel(options), 1);

        transform.zoom = 1;
        t.deepEqual(transform.coveringZoomLevel(options), 2);

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringZoomLevel(options), 3);

        transform.zoom = 10;
        t.deepEqual(transform.coveringZoomLevel(options), 11);

        transform.zoom = 11;
        t.deepEqual(transform.coveringZoomLevel(options), 12);

        transform.zoom = 11.5;
        t.deepEqual(transform.coveringZoomLevel(options), 12);

        options.roundZoom = true;

        t.deepEqual(transform.coveringZoomLevel(options), 13);

        t.end();
    });

    t.test('clamps pitch', function(t) {
        var transform = new Transform();

        transform.pitch = 45;
        t.equal(transform.pitch, 45);

        transform.pitch = -10;
        t.equal(transform.pitch, 0);

        transform.pitch = 90;
        t.equal(transform.pitch, 60);

        t.end();
    });

    t.end();
});
