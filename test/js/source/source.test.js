'use strict';

var test = require('tape');
var st = require('st');
var http = require('http');

require('../../bootstrap');

var Source = require('../../../js/source/source');
var Map = require('../../../js/ui/map');

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

        t.ok(source.loaded());
        t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
        t.deepEqual(source.minzoom, 1);
        t.deepEqual(source.maxzoom, 10);
        t.deepEqual(source.attribution, "Mapbox");
        t.end();
    });

    t.test('can be constructed from a TileJSON URL', function(t) {
        var source = new Source({
            type: "vector",
            url: "http://localhost:2900/source.json"
        });

        source.on('change', function() {
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

    function createMap() {
        return new Map({
            container: {
                offsetWidth: 200,
                offsetHeight: 200,
                classList: {
                    add: function() {}
                }
            },
            style: {
                version: 5,
                layers: []
            },
            interactive: false,
            attributionControl: false
        });
    }

    t.test('_getCoveringTiles', function(t) {
        var source = new Source({
            type: "vector",
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        var map = source.map = createMap();

        map.setZoom(0);
        t.deepEqual(source._getCoveringTiles(), []);

        map.setZoom(1);
        t.deepEqual(source._getCoveringTiles(), ['1', '33', '65', '97']);

        map.setZoom(2.4);
        t.deepEqual(source._getCoveringTiles(), ['162', '194', '290', '322']);

        map.setZoom(10);
        t.deepEqual(source._getCoveringTiles(), ['16760810', '16760842', '16793578', '16793610']);

        map.setZoom(11);
        t.deepEqual(source._getCoveringTiles(), ['16760810', '16760842', '16793578', '16793610']);

        t.end();
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

            var map = source.map = createMap();

            map.setZoom(0);
            t.deepEqual(source._coveringZoomLevel(), 0);

            map.setZoom(0.1);
            t.deepEqual(source._coveringZoomLevel(), 0);

            map.setZoom(1);
            t.deepEqual(source._coveringZoomLevel(), 1);

            map.setZoom(2.4);
            t.deepEqual(source._coveringZoomLevel(), 2);

            map.setZoom(10);
            t.deepEqual(source._coveringZoomLevel(), 10);

            map.setZoom(11);
            t.deepEqual(source._coveringZoomLevel(), 11);

            map.setZoom(11.5);
            t.deepEqual(source._coveringZoomLevel(), 11);

            t.end();
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

            var map = source.map = createMap();

            map.setZoom(0);
            t.deepEqual(source._coveringZoomLevel(), 1);

            map.setZoom(0.1);
            t.deepEqual(source._coveringZoomLevel(), 1);

            map.setZoom(1);
            t.deepEqual(source._coveringZoomLevel(), 2);

            map.setZoom(2.4);
            t.deepEqual(source._coveringZoomLevel(), 3);

            map.setZoom(10);
            t.deepEqual(source._coveringZoomLevel(), 11);

            map.setZoom(11);
            t.deepEqual(source._coveringZoomLevel(), 12);

            map.setZoom(11.5);
            t.deepEqual(source._coveringZoomLevel(), 12);

            t.end();
        });
    });

    t.end();
});
