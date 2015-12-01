'use strict';

var test = require('prova');
var st = require('st');
var http = require('http');
var path = require('path');
var VectorTileSource = require('../../../js/source/vector_tile_source');
var config = require('../../../js/util/config');

var server = http.createServer(st({path: path.join(__dirname, '/../../fixtures')}));

test('VectorTileSource', function(t) {
    t.test('before', function(t) {
        server.listen(2900, t.end);
    });

    t.test('can be constructed from TileJSON', function(t) {
        var source = new VectorTileSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        source.on('error', function(e) {
            t.fail(e.error);
            source.remove();
            t.end();
        });

        source.on('load', function() {
            t.ok(source.loaded());
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, "Mapbox");
            source.remove();
            t.end();
        });
    });

    t.test('can be constructed from a TileJSON URL', function(t) {
        var source = new VectorTileSource({
            url: "http://localhost:2900/source.json"
        });

        source.on('error', function(e) {
            t.fail(e.error);
            source.remove();
            t.end();
        });

        source.on('load', function() {
            t.ok(source.loaded());
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, "Mapbox");
            source.remove();
            t.end();
        });
    });

    t.test('can be refreshed from a TileJSON URL after token change', function(t) {
        var source = new VectorTileSource({
            url: "http://localhost:2900/source.json"
        });

        source.on('error', function(e) {
            t.fail(e.error);
            source.remove();
            t.end();
        });

        source.once('load', function() {
            t.ok(source.loaded());
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);

            var tilePyramid = source._pyramid;
            source.once('load', function() {
                t.ok(source.loaded());
                t.deepEqual(source.tiles, ["https://example.com/{z}/{x}/{y}.png"]);
                t.equal(tilePyramid, source._pyramid);

                source.remove();
                t.end();
            });

            // since the fixtures are static change the TileJSON URL
            // so we know the source has updated
            source.url = "http://localhost:2900/source_secure.json";
            config.fire('token.change');
        });
    });

    t.test('ignores reload before loaded', function(t) {
        var source = new VectorTileSource({
            url: "http://localhost:2900/source.json"
        });

        t.doesNotThrow(function() {
            source.reload();
        }, null, 'reload ignored gracefully');

        source.on('load', function() {
            source.remove();
            t.end();
        });
    });

    t.test('after', function(t) {
        server.close(t.end);
    });
});
