'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', (t) => {
    const map = createMap();

    map.on('dblclick', e => e.preventDefault());

    const zoom = t.spy();
    map.on('zoom', zoom);

    simulate.dblclick(map.getCanvas());

    t.equal(zoom.callCount, 0);

    map.remove();
    t.end();
});
