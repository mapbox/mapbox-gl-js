'use strict';

var test = require('tape');
var st = require('st');
var http = require('http');

require('../../bootstrap');

var Source = require('../../../js/source/source');
var Transform = require('../../../js/geo/transform');

var server = http.createServer(st({path: __dirname + '/../../fixtures'}));

test('Source', function(t) {
    t.test('before', function(t) {
        server.listen(2900, t.end);
    });

    t.test('can be constructed from TileJSON', function(t) {
        var source = new Source({
            type: "vector",
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        source.on('error', function(e) {
            t.fail(e.error);
            t.end();
        });

        source.on('load', function() {
            t.ok(source.loaded());
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, "Mapbox");
            t.end();
        });
    });

    t.test('can be constructed from a TileJSON URL', function(t) {
        var source = new Source({
            type: "vector",
            url: "http://localhost:2900/source.json"
        });

        source.on('error', function(e) {
            t.fail(e.error);
            t.end();
        });

        source.on('load', function() {
            t.ok(source.loaded());
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, "Mapbox");
            t.end();
        });
    });

    t.test('after', function(t) {
        server.close(t.end);
    });

    t.test('_getCoveringTiles', function(t) {
        var source = new Source({
            type: "vector",
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        source.on('load', function() {
            var transform = new Transform();

            transform.width = 200;
            transform.height = 200;

            transform.zoom = 0;
            t.deepEqual(source._getCoveringTiles(transform), []);

            transform.zoom = 1;
            t.deepEqual(source._getCoveringTiles(transform), ['1', '33', '65', '97']);

            transform.zoom = 2.4;
            t.deepEqual(source._getCoveringTiles(transform), ['162', '194', '290', '322']);

            transform.zoom = 10;
            t.deepEqual(source._getCoveringTiles(transform), ['16760810', '16760842', '16793578', '16793610']);

            transform.zoom = 11;
            t.deepEqual(source._getCoveringTiles(transform), ['16760810', '16760842', '16793578', '16793610']);

            t.end();
        });
    });

    t.test('_coveringZoomLevel', function(t) {
        t.test('vector', function() {
            var source = new Source({
                type: "vector",
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"]
            });

            source.on('load', function() {
                var transform = new Transform();

                transform.zoom = 0;
                t.deepEqual(source._coveringZoomLevel(transform), 0);

                transform.zoom = 0.1;
                t.deepEqual(source._coveringZoomLevel(transform), 0);

                transform.zoom = 1;
                t.deepEqual(source._coveringZoomLevel(transform), 1);

                transform.zoom = 2.4;
                t.deepEqual(source._coveringZoomLevel(transform), 2);

                transform.zoom = 10;
                t.deepEqual(source._coveringZoomLevel(transform), 10);

                transform.zoom = 11;
                t.deepEqual(source._coveringZoomLevel(transform), 11);

                transform.zoom = 11.5;
                t.deepEqual(source._coveringZoomLevel(transform), 11);

                t.end();
            });
        });

        t.test('raster', function(t) {
            var source = new Source({
                type: "raster",
                minzoom: 1,
                maxzoom: 10,
                tileSize: 256,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"]
            });

            source.on('load', function() {
                var transform = new Transform();

                transform.zoom = 0;
                t.deepEqual(source._coveringZoomLevel(transform), 1);

                transform.zoom = 0.1;
                t.deepEqual(source._coveringZoomLevel(transform), 1);

                transform.zoom = 1;
                t.deepEqual(source._coveringZoomLevel(transform), 2);

                transform.zoom = 2.4;
                t.deepEqual(source._coveringZoomLevel(transform), 3);

                transform.zoom = 10;
                t.deepEqual(source._coveringZoomLevel(transform), 11);

                transform.zoom = 11;
                t.deepEqual(source._coveringZoomLevel(transform), 12);

                transform.zoom = 11.5;
                t.deepEqual(source._coveringZoomLevel(transform), 12);

                t.end();
            });
        });
    });

    t.end();
});
