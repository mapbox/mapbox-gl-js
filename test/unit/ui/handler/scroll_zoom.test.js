'use strict';

const test = require('mapbox-gl-js-test').test;
const browser = require('../../../../src/util/browser');
const util = require('../../../../src/util/util');
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap(options) {
    return new Map(util.extend({
        container: DOM.create('div', '', window.document.body),
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    }, options));
}

test('ScrollZoomHandler zooms in response to wheel events', (t) => {
    const map = createMap();

    const browserNow = t.stub(browser, 'now');

    const startingZoom = map.getZoom();

    let now = 1555555555555;
    browserNow.callsFake(() => now);

    map._updateCamera();

    // simulate a series of 'wheel' events representing approx 1 second
    // of continuous scrolling
    let count = 200;
    while (--count) {
        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -50});
        now += 5;
        if (count % 4 === 0) {
            // simulate a render (animation frame) every ~20ms
            map._updateCamera();
        }
    }

    now += 400;
    map._updateCamera();

    // verified experimentally that the simulated scrolling above should
    // cause a zoom delta well larger than 3
    t.ok(map.getZoom() - startingZoom > 3);

    map.remove();
    t.end();
});

