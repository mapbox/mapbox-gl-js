'use strict';

const test = require('mapbox-gl-js-test').test;
const browser = require('../../../src/util/browser');

test('browser', (t) => {
    t.test('frame', (t) => {
        const id = browser.frame(() => {
            t.pass('called frame');
            t.ok(id, 'returns id');
            t.end();
        });
    });

    t.test('now', (t) => {
        t.equal(typeof browser.now(), 'number');
        t.end();
    });

    t.test('cancelFrame', (t) => {
        const id = browser.frame(() => {
            t.fail();
        });
        browser.cancelFrame(id);
        t.end();
    });

    t.test('devicePixelRatio', (t) => {
        t.equal(typeof browser.devicePixelRatio, 'number');
        t.end();
    });

    t.test('hardwareConcurrency', (t) => {
        t.equal(typeof browser.hardwareConcurrency, 'number');
        t.end();
    });

    t.test('supportsWebp', (t) => {
        t.equal(typeof browser.supportsWebp, 'boolean');
        t.end();
    });

    t.end();
});
