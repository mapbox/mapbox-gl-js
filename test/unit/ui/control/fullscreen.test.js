'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const FullscreenControl = require('../../../../src/ui/control/fullscreen_control');

function createMap() {
    const container = window.document.createElement('div');
    return new Map({
        container: container,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    });
}

test('FullscreenControl appears then fullscreen enabled', (t) => {
    window.document.fullscreenEnabled = true;

    const map = createMap();
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-fullscreen').length, 1);
    t.end();
});

test('FullscreenControl does not appears then fullscreen is not enabled', (t) => {
    window.document.fullscreenEnabled = false;

    const map = createMap();
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-fullscreen').length, 0);
    t.end();
});
