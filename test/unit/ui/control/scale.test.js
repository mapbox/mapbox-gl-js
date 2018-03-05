'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const ScaleControl = require('../../../../src/ui/control/scale_control');

function createMap() {
    const container = window.document.createElement('div');
    return new Map({
        container,
        style: {
            version: 8,
            sources: {},
            layers: []
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

test('ScaleControl should change unit of distance after calling setUnit', (t) => {
    const map = createMap();
    const scale = new ScaleControl();
    const selector = '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-scale';
    map.addControl(scale);

    let contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /km/);

    scale.setUnit('imperial');
    contents = map.getContainer().querySelector(selector).innerHTML;
    t.match(contents, /mi/);
    t.end();
});
