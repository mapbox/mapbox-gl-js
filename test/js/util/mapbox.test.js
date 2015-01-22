'use strict';

var test = require('tape');
var mapbox = require('../../../js/util/mapbox');
var config = require('../../../js/util/config');

test("mapbox", function(t) {
    config.ACCESS_TOKEN = 'key';

    t.test('.normalizeSourceURL', function(t) {
        t.test('returns a v4 URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=key');
            t.end();
        });

        t.test('uses provided access token', function(t) {
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map', 'token'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=token');
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

        t.test('returns a v4 URL with access_token parameter', function(t) {
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=key');
            t.end();
        });

        t.test('appends &secure and uses https when FORCE_HTTPS is set', function(t) {
            config.FORCE_HTTPS = true;
            t.equal(mapbox.normalizeSourceURL('mapbox://user.map'), 'https://a.tiles.mapbox.com/v4/user.map.json?access_token=key&secure');
            config.FORCE_HTTPS = false;
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
            t.equal(mapbox.normalizeGlyphsURL('mapbox://fontstack/{fontstack}/{range}.pbf'), 'http://a.tiles.mapbox.com/v4/fontstack/{fontstack}/{range}.pbf?access_token=key');
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
            t.equal(mapbox.normalizeStyleURL('mapbox://user.style'), 'http://a.tiles.mapbox.com/styles/v1/user/user.style?access_token=key');
            t.end();
        });

        t.test('ignores non-mapbox:// scheme', function(t) {
            t.equal(mapbox.normalizeStyleURL('http://path'), 'http://path');
            t.end();
        });

        t.end();
    });

    t.end();
});
