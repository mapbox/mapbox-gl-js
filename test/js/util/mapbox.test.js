'use strict';

var test = require('prova');
var mapbox = require('../../../js/util/mapbox');
var config = require('../../../js/util/config');
var browser = require('../../../js/util/browser');

test("mapbox", function(t) {
    var mapboxSource = 'mapbox://user.map';
    var nonMapboxSource = 'http://www.example.com/tiles.json';
    config.ACCESS_TOKEN = 'key';

    t.test('.normalizeStyleURL', function(t) {
        t.test('returns an API URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeStyleURL('mapbox://styles/user/style'), 'https://api.mapbox.com/styles/v1/user/style?access_token=key');
            t.equal(mapbox.normalizeStyleURL('mapbox://styles/user/style/draft'), 'https://api.mapbox.com/styles/v1/user/style/draft?access_token=key');
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeStyleURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeSourceURL', function(t) {
        t.test('returns a v4 URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeSourceURL(mapboxSource), 'https://api.mapbox.com/v4/user.map.json?access_token=key&secure');
            t.end();
        });

        t.test('uses provided access token', function(t) {
            t.equal(mapbox.normalizeSourceURL(mapboxSource, 'token'), 'https://api.mapbox.com/v4/user.map.json?access_token=token&secure');
            t.end();
        });

        t.test('throws an error if no access token is provided', function(t) {
            config.ACCESS_TOKEN = null;
            t.throws(function() { mapbox.normalizeSourceURL(mapboxSource); }, 'An API access token is required to use Mapbox GL.');
            config.ACCESS_TOKEN = 'key';
            t.end();
        });

        t.test('throws an error if a secret access token is provided', function(t) {
            config.ACCESS_TOKEN = 'sk.abc.123';
            t.throws(function() { mapbox.normalizeSourceURL(mapboxSource); }, 'Use a public access token (pk.*) with Mapbox GL JS.');
            config.ACCESS_TOKEN = 'key';
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeSourceURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeGlyphsURL', function(t) {
        t.test('normalizes mapbox:// URLs', function(t) {
            t.equal(
                mapbox.normalizeGlyphsURL('mapbox://fonts/boxmap/{fontstack}/{range}.pbf'),
                'https://api.mapbox.com/fonts/v1/boxmap/{fontstack}/{range}.pbf?access_token=key'
            );
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeGlyphsURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeSpriteURL', function(t) {
        t.test('normalizes mapbox:// URLs', function(t) {
            t.equal(
                mapbox.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8', '', '.json'),
                'https://api.mapbox.com/styles/v1/mapbox/streets-v8/sprite.json?access_token=key'
            );

            t.equal(
                mapbox.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8', '@2x', '.png'),
                'https://api.mapbox.com/styles/v1/mapbox/streets-v8/sprite@2x.png?access_token=key'
            );

            t.equal(
                mapbox.normalizeSpriteURL('mapbox://sprites/mapbox/streets-v8/draft', '@2x', '.png'),
                'https://api.mapbox.com/styles/v1/mapbox/streets-v8/draft/sprite@2x.png?access_token=key'
            );

            t.end();
        });

        t.test('concantenates path, ratio, and extension for non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeSpriteURL('http://www.foo.com/bar', '@2x', '.png'), 'http://www.foo.com/bar@2x.png');
            t.end();
        });
    });

    t.test('.normalizeTileURL', function(t) {
        t.test('no-op for all vector URLs', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.vector.pbf', mapboxSource), 'http://path.png/tile.vector.pbf');
            t.end();
        });

        t.test('inserts @2x for all image URLs', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png', mapboxSource), 'http://path.png/tile@2x.png');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png32', mapboxSource), 'http://path.png/tile@2x.png32');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.jpg70', mapboxSource), 'http://path.png/tile@2x.jpg70');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png?access_token=foo', mapboxSource), 'http://path.png/tile@2x.png?access_token=foo');
            t.end();
        });

        t.test('replaces img extension with webp on supporting devices', function(t) {
            browser.supportsWebp = true;
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png', mapboxSource), 'http://path.png/tile@2x.webp');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png32', mapboxSource), 'http://path.png/tile@2x.webp');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.jpg70', mapboxSource), 'http://path.png/tile@2x.webp');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png?access_token=foo', mapboxSource), 'http://path.png/tile@2x.webp?access_token=foo');
            browser.supportsWebp = false;
            t.end();
        });

        t.test('ignores non-mapbox:// sources', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png', nonMapboxSource), 'http://path.png');
            t.end();
        });

        t.test('ignores undefined sources', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png'), 'http://path.png');
            t.end();
        });

        t.test('replace temp access tokens with the latest token', function(t) {
            t.equal(mapbox.normalizeTileURL('http://example.com/tile.png?access_token=tk.abc.123', mapboxSource), 'http://example.com/tile@2x.png?access_token=key');
            t.equal(mapbox.normalizeTileURL('http://example.com/tile.png?foo=bar&access_token=tk.abc.123', mapboxSource), 'http://example.com/tile@2x.png?foo=bar&access_token=key');
            t.equal(mapbox.normalizeTileURL('http://example.com/tile.png?access_token=tk.abc.123&foo=bar', 'mapbox://user.map'), 'http://example.com/tile@2x.png?access_token=key&foo=bar');
            t.end();
        });

        t.test('does not modify the access token for non-mapbox sources', function(t) {
            t.equal(mapbox.normalizeTileURL('http://example.com/tile.png?access_token=tk.abc.123', nonMapboxSource), 'http://example.com/tile.png?access_token=tk.abc.123');
            t.end();
        });

        t.test('does not modify the access token for non temp tokens', function(t) {
            t.equal(mapbox.normalizeTileURL('http://example.com/tile.png?access_token=pk.abc.123', mapboxSource), 'http://example.com/tile@2x.png?access_token=pk.abc.123');
            t.equal(mapbox.normalizeTileURL('http://example.com/tile.png?access_token=tkk.abc.123', mapboxSource), 'http://example.com/tile@2x.png?access_token=tkk.abc.123');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeTileSize', function(t) {
        t.test('512 on 1x devices', function(t) {
            t.equal(mapbox.normalizeTileSize(64, mapboxSource), 512);
            t.equal(mapbox.normalizeTileSize(128, mapboxSource), 512);
            t.equal(mapbox.normalizeTileSize(256, mapboxSource), 512);
            t.equal(mapbox.normalizeTileSize(512, mapboxSource), 512);
            t.end();
        });

        t.test('256 on 2x devices', function(t) {
            browser.devicePixelRatio = 2;
            t.equal(mapbox.normalizeTileSize(64, mapboxSource), 256);
            t.equal(mapbox.normalizeTileSize(128, mapboxSource), 256);
            t.equal(mapbox.normalizeTileSize(256, mapboxSource), 256);
            t.equal(mapbox.normalizeTileSize(512, mapboxSource), 256);
            browser.devicePixelRatio = 1;
            t.end();
        });

        t.test('no-op on non-mapbox sources', function(t) {
            t.equal(mapbox.normalizeTileSize(64, nonMapboxSource), 64);
            t.equal(mapbox.normalizeTileSize(128, nonMapboxSource), 128);
            t.equal(mapbox.normalizeTileSize(256, nonMapboxSource), 256);
            t.equal(mapbox.normalizeTileSize(512, nonMapboxSource), 512);
            browser.devicePixelRatio = 2;
            t.equal(mapbox.normalizeTileSize(64, nonMapboxSource), 64);
            t.equal(mapbox.normalizeTileSize(128, nonMapboxSource), 128);
            t.equal(mapbox.normalizeTileSize(256, nonMapboxSource), 256);
            t.equal(mapbox.normalizeTileSize(512, nonMapboxSource), 512);
            browser.devicePixelRatio = 1;
            t.end();
        });

        t.end();
    });

    t.end();
});
