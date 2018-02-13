'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const config = require('../../../../src/util/config');
const ScaleControl = require('../../../../src/ui/control/scale_control');

function createMap() {
    const container = window.document.createElement('div');
    config.ACCESS_TOKEN = 'pk.123';
    return new Map({
        container: container,
        style: {
            version: 8,
            sources: {},
            layers: [],
            owner: 'mapbox',
            id: 'streets-v10',
        },
        hash: true
    });

}

test('ScaleControl appears in bottom-left by default', (t) => {
    const map = createMap();
    map.addControl(new ScaleControl());

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale').length, 1);
    t.end();
});

test('ScaleControl appears in the position specified by the position option', (t) => {
    const map = createMap();
    map.addControl(new ScaleControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-scale').length, 1);
    t.end();
});
