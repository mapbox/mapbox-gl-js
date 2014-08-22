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
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        t.ok(source.enabled);
        t.deepEqual(source.tileJSON.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
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
                t.deepEqual(source.tileJSON.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
                t.end();
            }
        };
    });

    t.test('after', function(t) {
        server.close(t.end);
    });

    t.end();
});
