'use strict';

var test = require('tap').test;
var VectorTileSource = require('../../../js/source/vector_tile_source');
var TileCoord = require('../../../js/source/tile_coord');
var window = require('../../../js/util/window');

function createSource(options) {
    var source = new VectorTileSource('id', options, { send: function() {} });

    source.on('error', function(e) {
        throw e.error;
    });

    source.map = {
        transform: { angle: 0, pitch: 0, showCollisionBoxes: false }
    };

    return source;
}

test('VectorTileSource', function(t) {
    t.beforeEach(function(callback) {
        window.useFakeXMLHttpRequest();
        callback();
    });

    t.afterEach(function(callback) {
        window.restore();
        callback();
    });

    t.test('can be constructed from TileJSON', function(t) {
        var source = createSource({
            minzoom: 1,
            maxzoom: 10,
            attribution: "Mapbox",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        source.on('sourceload', function() {
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, "Mapbox");
            t.end();
        });
    });

    t.test('can be constructed from a TileJSON URL', function(t) {
        window.server.respondWith('/source.json', JSON.stringify(require('../../fixtures/source')));

        var source = createSource({ url: "/source.json" });

        source.on('sourceload', function() {
            t.deepEqual(source.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
            t.deepEqual(source.minzoom, 1);
            t.deepEqual(source.maxzoom, 10);
            t.deepEqual(source.attribution, "Mapbox");
            t.end();
        });

        window.server.respond();
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

            source.on('sourceload', function() {
                source.loadTile({coord: new TileCoord(10, 5, 5, 0)}, function () {});
            });
        });
    }

    testScheme('xyz', 'http://example.com/10/5/5.png');
    testScheme('tms', 'http://example.com/10/5/1018.png');

    t.test('reloads a loading tile properly', function (t) {
        var source = createSource({
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });
        var events = [];
        source.dispatcher.send = function(type, params, cb) {
            events.push(type);
            setTimeout(cb, 0);
            return 1;
        };

        source.on('sourceload', function () {
            var tile = {
                coord: new TileCoord(10, 5, 5, 0),
                state: 'loading',
                loadVectorData: function () {
                    this.state = 'loaded';
                    events.push('tile loaded');
                }
            };
            source.loadTile(tile, function () {});
            t.equal(tile.state, 'loading');
            source.loadTile(tile, function () {
                t.same(events, ['load tile', 'tile loaded', 'reload tile', 'tile loaded']);
                t.end();
            });
        });
    });

    t.end();
});
