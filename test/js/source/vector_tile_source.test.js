'use strict';

var test = require('tap').test;
var st = require('st');
var http = require('http');
var path = require('path');
var VectorTileSource = require('../../../js/source/vector_tile_source');

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
            t.error(e.error);
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
        var source = new VectorTileSource({
            url: "http://localhost:2900/source.json"
        });

        source.on('error', function(e) {
            t.error(e.error);
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
        var source = new VectorTileSource({
            url: "http://localhost:2900/source.json"
        });

        t.doesNotThrow(function() {
            source.reload();
        }, null, 'reload ignored gracefully');

        source.on('load', function() {
            t.end();
        });
    });

    t.test('serialize', function(t) {
        var source = new VectorTileSource({
            url: "http://example.com"
        });
        t.deepEqual(source.serialize(), {
            type: 'vector',
            url: "http://example.com"
        });
        t.end();
    });

    t.test('serialize TileJSON', function(t) {
        var source = new VectorTileSource({
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

    t.test('after', function(t) {
        server.close(t.end);
    });

    t.end();
});
