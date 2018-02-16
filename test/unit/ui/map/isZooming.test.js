'use strict';

const test = require('mapbox-gl-js-test').test;
const browser = require('../../../../src/util/browser');
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('Map#isZooming returns false by default', (t) => {
    const map = createMap();
    t.equal(map.isZooming(), false);
    map.remove();
    t.end();
});

test('Map#isZooming returns true during a camera zoom animation', (t) => {
    const map = createMap();

    map.on('zoomstart', () => {
        t.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isZooming(), false);
        map.remove();
        t.end();
    });

    map.zoomTo(5, { duration: 0 });
});

test('Map#isZooming returns true when scroll zooming', (t) => {
    const map = createMap();

    map.on('zoomstart', () => {
        t.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isZooming(), false);
        map.remove();
        t.end();
    });

    const browserNow = t.stub(browser, 'now');
    let now = 0;
    browserNow.callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._updateCamera();

    now += 400;
    map._updateCamera();
});
