'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../js/util/window');
const Map = require('../../../../js/ui/map');
const LogoControl = require('../../../../js/ui/control/logo_control');

function createMap() {
    const container = window.document.createElement('div');
    return new Map({
        container: container,
        attributionControl: false,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    });
}

test('LogoControl appears in bottom-left by default', (t) => {
    const map = createMap();

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-logo').length, 1);
    t.end();
});

test('LogoControl appears in the position specified by the position option', (t) => {
    const map = createMap();
    map.addControl(new LogoControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-logo').length, 1);
    t.end();
});

test('LogoControl is removed from map when map.removeControl is called', (t) => {
    const map = createMap();
    const logoControl = new LogoControl();
    map.addControl(logoControl, 'top-left');
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-logo').length, 1);
    map.removeControl(logoControl);
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-logo').length, 0);
    t.end();
});


