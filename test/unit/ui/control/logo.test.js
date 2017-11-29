'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');

test('LogoControl appears in bottom-left by default', (t) => {
    const container = window.document.createElement('div');
    const map = new Map({container});
    t.equal(map.getContainer().querySelectorAll(
        '.mapboxgl-ctrl-bottom-left .mapboxgl-ctrl-logo'
    ).length, 1);
    t.end();
});

test('LogoControl appears in the position specified by the position option', (t) => {
    const container = window.document.createElement('div');
    const map = new Map({container, logoPosition: 'top-left'});
    t.equal(map.getContainer().querySelectorAll(
        '.mapboxgl-ctrl-top-left .mapboxgl-ctrl-logo'
    ).length, 1);
    t.end();
});

test('LogoControl is hidden when no sources with the mapbox_logo property exist', (t) => {
    const container = window.document.createElement('div');
    const map = new Map({
        container,
        style: {
            version: 8,
            sources: {},
            layers: []
        },
    });
    map.on('load', () => {
        t.equal(map.getContainer().querySelector('.mapboxgl-ctrl-logo').parentNode.style.display, 'none');
        t.end();
    });
});

test('LogoControl is shown when a source with the mapbox_logo property is added', (t) => {
    const container = window.document.createElement('div');
    const map = new Map({
        container,
        style: {
            version: 8,
            sources: {},
            layers: []
        },
    });
    map.on('load', () => {
        map.addSource('source', {
            type: 'raster',
            tiles: ["http://example.com/{z}/{x}/{y}.png"],
            mapbox_logo: true // eslint-disable-line
        });
        map.once('sourcedata', () => {
            t.equal(map.getContainer().querySelector('.mapboxgl-ctrl-logo').parentNode.style.display, 'block');
            t.end();
        });
    });
});

test('LogoControl is visible when a source with the mapbox_logo property exists', (t) => {
    const container = window.document.createElement('div');
    const map = new Map({
        container,
        style: {
            version: 8,
            sources: {
                source: {
                    type: 'raster',
                    tiles: ["http://example.com/{z}/{x}/{y}.png"],
                    mapbox_logo: true // eslint-disable-line
                }
            },
            layers: []
        },
    });
    map.on('load', () => {
        t.equal(map.getContainer().querySelector('.mapboxgl-ctrl-logo').parentNode.style.display, 'block');
        t.end();
    });
});

test('LogoControl is hidden when the last source with the mapbox_logo property is removed', (t) => {
    const container = window.document.createElement('div');
    const map = new Map({
        container,
        style: {
            version: 8,
            sources: {
                source: {
                    type: 'raster',
                    tiles: ["http://example.com/{z}/{x}/{y}.png"],
                    mapbox_logo: true // eslint-disable-line
                }
            },
            layers: []
        },
    });
    map.on('load', () => {
        map.removeSource('source');
        map.once('styledata', () => {
            t.equal(map.getContainer().querySelector('.mapboxgl-ctrl-logo').parentNode.style.display, 'none');
            t.end();
        });
    });
});
