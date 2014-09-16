'use strict';

var test = require('tape').test;
var Source = require('../../../js/source/source');
var st = require('st');
var http = require('http');

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

        t.ok(source.enabled);
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

        source.map = {
            fire: function() {
                t.ok(source.enabled);
                t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
                t.deepEqual(source.minzoom, 1);
                t.deepEqual(source.maxzoom, 10);
                t.deepEqual(source.attribution, "Mapbox");
                t.end();
            }
        };
    });

    t.test('after', function(t) {
        server.close(t.end);
    });

    t.end();
});
