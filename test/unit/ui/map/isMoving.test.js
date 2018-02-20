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

test('Map#isMoving returns false by default', (t) => {
    const map = createMap();
    t.equal(map.isMoving(), false);
    map.remove();
    t.end();
});

test('Map#isMoving returns true during a camera zoom animation', (t) => {
    const map = createMap();

    map.on('zoomstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    map.zoomTo(5, { duration: 0 });
});

test('Map#isMoving returns true when drag panning', (t) => {
    const map = createMap();

    map.on('dragstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('dragend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas());
    map._updateCamera();

    simulate.mousemove(map.getCanvas());
    map._updateCamera();

    simulate.mouseup(map.getCanvas());
    map._updateCamera();
});

test('Map#isMoving returns true when drag rotating', (t) => {
    const map = createMap();

    map.on('rotatestart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('rotateend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._updateCamera();
});

test('Map#isMoving returns true when scroll zooming', (t) => {
    const map = createMap();

    map.on('zoomstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isMoving(), false);
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

test('Map#isMoving returns true when drag panning and scroll zooming interleave', (t) => {
    const map = createMap();

    map.on('dragstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isMoving(), true);
        simulate.mouseup(map.getCanvas());
        map._updateCamera();
    });

    map.on('dragend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    // The following should trigger the above events, where a zoomstart/zoomend
    // pair is nested within a dragstart/dragend pair.

    simulate.mousedown(map.getCanvas());
    map._updateCamera();

    simulate.mousemove(map.getCanvas());
    map._updateCamera();

    const browserNow = t.stub(browser, 'now');
    let now = 0;
    browserNow.callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._updateCamera();

    now += 400;
    map._updateCamera();
});
