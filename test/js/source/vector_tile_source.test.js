'use strict';

var test = require('prova');
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
        var source = new VectorTileSource({
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
});
