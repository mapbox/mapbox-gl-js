'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('TouchZoomRotateHandler does not begin a box zoom if preventDefault is called on the touchstart event', (t) => {
    const map = createMap();

    map.on('touchstart', e => e.preventDefault());

    const move = t.spy();
    map.on('move', move);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 5, clientY: 0}]});
    map._updateCamera();

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 5}]});
    map._updateCamera();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._updateCamera();

    t.equal(move.callCount, 0);

    map.remove();
    t.end();
});
