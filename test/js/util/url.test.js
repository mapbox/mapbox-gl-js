'use strict';

var test = require('tape').test;
var url = require('../../../js/util/url.js');
var config = require('../../../js/util/config.js');

test("url", function(t) {
    config.ACCESS_TOKEN = 'key';

    t.test('returns a v4 URL with access_token parameter', function(t) {
        t.equal(url('/user.map.json'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=key');
        t.end();
    });

    t.test('uses provided access token', function(t) {
        t.equal(url('/user.map.json', 'token'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=token');
        t.end();
    });

    t.test('throws an error if no access token is provided', function(t) {
        config.ACCESS_TOKEN = null;
        t.throws(function() { url('/user.map.json'); }, 'An API access token is required to use Mapbox GL.');
        config.ACCESS_TOKEN = 'key';
        t.end();
    });

    t.test('throws an error if a secret access token is provided', function(t) {
        config.ACCESS_TOKEN = 'sk.abc.123';
        t.throws(function() { url('/user.map.json'); }, 'Use a public access token (pk.*) with Mapbox GL JS.');
        config.ACCESS_TOKEN = 'key';
        t.end();
    });

    t.test('.tileJSON', function(t) {
        t.test('returns a v4 URL with access_token parameter', function(t) {
            t.equal(url.tileJSON('user.map'), 'http://a.tiles.mapbox.com/v4/user.map.json?access_token=key');
            t.end();
        });

        t.test('appends &secure and uses https when FORCE_HTTPS is set', function(t) {
            config.FORCE_HTTPS = true;
            t.equal(url.tileJSON('user.map'), 'https://a.tiles.mapbox.com/v4/user.map.json?access_token=key&secure');
            config.FORCE_HTTPS = false;
            t.end();
        });

        t.end();
    });

    t.end();
});
