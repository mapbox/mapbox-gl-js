'use strict';

var test = require('tap').test;
var browser = require('../../../js/util/browser');

test('browser', function(t) {
    t.test('supported', function(t) {
        t.equal(browser.supported(), true);
        t.end();
    });

    t.test('frame', function(t) {
        var id = browser.frame(function() {
            t.pass('called frame');
            t.ok(id, 'returns id');
            t.end();
        });
    });

    t.test('now', function(t) {
        t.equal(typeof browser.now(), 'number');
        t.end();
    });

    t.test('cancelFrame', function(t) {
        var id = browser.frame(function() {
            t.fail();
        });
        browser.cancelFrame(id);
        t.end();
    });

    t.test('devicePixelRatio', function(t) {
        t.equal(typeof browser.devicePixelRatio, 'number');
        t.end();
    });

    t.test('hardwareConcurrency', function(t) {
        t.equal(typeof browser.hardwareConcurrency, 'number');
        t.end();
    });

    t.test('supportsWebp', function(t) {
        t.equal(typeof browser.supportsWebp, 'boolean');
        t.end();
    });

    t.test('supportsGeolocation', function(t) {
        t.equal(typeof browser.supportsGeolocation, 'boolean');
        t.end();
    });

    t.end();
});
