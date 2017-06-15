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

test('FullscreenControl with no options', (t) => {
    t.plan(0);

    const map = createMap();
    const fullscreen = new FullscreenControl();
    map.addControl(fullscreen);
    t.end();
});
