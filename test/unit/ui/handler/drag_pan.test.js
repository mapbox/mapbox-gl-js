'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('DragPanHandler requests a new render frame after each mousemove event', (t) => {
    const map = createMap();
    const update = t.spy(map, '_update');

    simulate.mousedown(map.getCanvas());
    simulate.mousemove(map.getCanvas());
    t.ok(update.callCount > 0);

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    update.reset();
    simulate.mousemove(map.getCanvas());
    t.equal(update.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler recovers after interruption by another handler', (t) => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();
    const initialCenter = map.getCenter();
    simulate.mousedown(map.getCanvas(), {clientX: 10, clientY: 10});
    simulate.mousemove(map.getCanvas(), {clientX: 12, clientY: 10});
    map._updateCamera();

    // simluates another handler taking over
    map.stop();

    simulate.mousemove(map.getCanvas(), {clientX: 14, clientY: 10});
    simulate.mousemove(map.getCanvas(), {clientX: 16, clientY: 10});
    map._updateCamera();
    t.equalWithPrecision(map.getCenter().lng, initialCenter.lng - 2.8125, 1e-4);

    map.remove();
    t.end();
});
