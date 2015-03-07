'use strict';

var test = require('tape');
var mapbox = require('../../../js/util/mapbox');
var config = require('../../../js/util/config');
var browser = require('../../../js/util/browser');

test("mapbox", function(t) {
    config.ACCESS_TOKEN = 'key';

    t.test('.normalizeSourceURL', function(t) {
        t.test('returns a v4 URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map'), 'https://a.tiles.mapbox.com/v4/user.map.json?access_token=key&secure');
            t.end();
        });

        t.test('uses provided access token', function(t) {
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map', 'token'), 'https://a.tiles.mapbox.com/v4/user.map.json?access_token=token&secure');
            t.end();
        });

        t.test('throws an error if no access token is provided', function(t) {
            config.ACCESS_TOKEN = null;
            t.throws(function() { mapbox.normalizeSourceURL('mapbox://user.map'); }, 'An API access token is required to use Mapbox GL.');
            config.ACCESS_TOKEN = 'key';
            t.end();
        });

        t.test('throws an error if a secret access token is provided', function(t) {
            config.ACCESS_TOKEN = 'sk.abc.123';
            t.throws(function() { mapbox.normalizeSourceURL('mapbox://user.map'); }, 'Use a public access token (pk.*) with Mapbox GL JS.');
            config.ACCESS_TOKEN = 'key';
            t.end();
        });

        t.test('omits &secure and uses http when FORCE_HTTPS is false', function(t) {
            config.FORCE_HTTPS = false;
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=key');
            config.FORCE_HTTPS = true;
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeSourceURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeGlyphsURL', function(t) {
        t.test('returns a v4 URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeGlyphsURL('mapbox://fontstack/{fontstack}/{range}.pbf'), 'https://a.tiles.mapbox.com/v4/fontstack/{fontstack}/{range}.pbf?access_token=key');
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeGlyphsURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeStyleURL', function(t) {
        t.test('returns an API URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeStyleURL('mapbox://user.style'), 'https://a.tiles.mapbox.com/styles/v1/user/user.style?access_token=key');
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeStyleURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.test('.normalizeTileURL', function(t) {
        t.test('does nothing on 1x devices', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png', 'mapbox://user.map'), 'http://path.png/tile.png');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png32', 'mapbox://user.map'), 'http://path.png/tile.png32');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.jpg70', 'mapbox://user.map'), 'http://path.png/tile.jpg70');
            t.end();
        });

        t.test('inserts @2x on 2x devices', function(t) {
            browser.devicePixelRatio = 2;
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png', 'mapbox://user.map'), 'http://path.png/tile@2x.png');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png32', 'mapbox://user.map'), 'http://path.png/tile@2x.png32');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.jpg70', 'mapbox://user.map'), 'http://path.png/tile@2x.jpg70');
            t.equal(mapbox.normalizeTileURL('http://path.png/tile.png?access_token=foo', 'mapbox://user.map'), 'http://path.png/tile@2x.png?access_token=foo');
            browser.devicePixelRatio = 1;
            t.end();
        });

        t.test('ignores non-mapbox:// sources', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png', 'http://path'), 'http://path.png');
            t.end();
        });

        t.test('ignores undefined sources', function(t) {
            t.equal(mapbox.normalizeTileURL('http://path.png'), 'http://path.png');
            t.end();
        });

        t.end();
    });

    t.end();
});
