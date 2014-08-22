'use strict';

var test = require('tape').test,
    Source = require('../../../js/source/source');

test('Source', function(t) {
    test('can be constructed from TileJSON', function(t) {
        var source = new Source({
            type: "vector",
            tiles: ["http://example.com/{z}/{x}/{y}.png"]
        });

        t.ok(source.enabled);
        t.deepEqual(source.tileJSON.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
        t.end();
    });

    test('can be constructed from a TileJSON URL', function(t) {
        Source.protocols.test = function(url, callback) {
            t.equal(url, "test://example.com/tiles.json");
            callback(null, {
                tiles: ["http://example.com/{z}/{x}/{y}.png"]
            });
        };

        var source = new Source({
            type: "vector",
            url: "test://example.com/tiles.json"
        });

        t.ok(source.enabled);
        t.deepEqual(source.tileJSON.tiles, ["http://example.com/{z}/{x}/{y}.png"]);
        t.end();
    });

    t.end();
});
