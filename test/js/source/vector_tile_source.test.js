'use strict';

var test = require('tap').test;
var st = require('st');
var http = require('http');
var path = require('path');
var VectorTileSource = require('../../../js/source/vector_tile_source');
var TileCoord = require('../../../js/source/tile_coord');

var server = http.createServer(st({path: path.join(__dirname, '/../../fixtures')}));

function createSource(options) {
    var source = new VectorTileSource(options);

    source.on('error', function(e) {
        throw e.error;
    });

    source.dispatcher = { send: function() {} };

    source.map = {
        transform: { angle: 0, pitch: 0, showCollisionBoxes: false }
    };

    return source;
}

test('VectorTileSource', function(t) {
    t.test('before', function(t) {
        server.listen(2900, t.end);
    });

    t.test('can be constructed from TileJSON', function(t) {
        var source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
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
        var source = createSource({
            url: "http://localhost:2900/source.json"
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

    t.test('ignores reload before loaded', function(t) {
        var source = createSource({
            url: "http://localhost:2900/source.json"
        });

        t.doesNotThrow(function() {
            source.reload();
        }, null, 'reload ignored gracefully');

        source.on('load', function() {
            t.end();
        });
    });

    t.test('serialize URL', function(t) {
        var source = createSource({
            url: "http://localhost:2900/source.json"
        });
        t.deepEqual(source.serialize(), {
            type: 'vector',
            url: "http://localhost:2900/source.json"
        });
        t.end();
    });

    t.test('serialize TileJSON', function(t) {
        var source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        t.deepEqual(source.serialize(), {
            type: 'vector',
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        t.end();
    });

    t.test('queryRenderedFeatures', function(t) {
        t.test('returns an empty object before loaded', function(t) {
            var source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"]
            });
            t.deepEqual(source.queryRenderedFeatures(), []);
            t.end();
        });
        t.end();
    });

    function testScheme(scheme, expectedURL) {
        t.test('scheme "' + scheme + '"', function(t) {
            var source = createSource({
                minzoom: 1,
                maxzoom: 10,
                attribution: "Mapbox",
                tiles: ["http://example.com/{z}/{x}/{y}.png"],
                scheme: scheme
            });

            source.dispatcher.send = function(type, params) {
                t.equal(type, 'load tile');
                t.equal(expectedURL, params.url);
                t.end();
            };

            source.on('load', function() {
                source._loadTile({coord: new TileCoord(10, 5, 5, 0)});
            });
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    t.test('after', function(t) {
        server.close(t.end);
    });

    t.end();
});
