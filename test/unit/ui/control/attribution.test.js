'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const AttributionControl = require('../../../../src/ui/control/attribution_control');

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

test('AttributionControl appears in bottom-right by default', (t) => {
    const map = createMap();
    map.addControl(new AttributionControl());

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('AttributionControl appears in the position specified by the position option', (t) => {
    const map = createMap();
    map.addControl(new AttributionControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('AttributionControl appears in compact mode if compact option is used', (t) => {
    const map = createMap();
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});

    let attributionControl = new AttributionControl({
        compact: true
    });
    map.addControl(attributionControl);

    const container = map.getContainer();

    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib.compact').length, 1);
    map.removeControl(attributionControl);

    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
    attributionControl = new AttributionControl({
        compact: false
    });

    map.addControl(attributionControl);
    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib:not(.compact)').length, 1);
    t.end();
});

test('AttributionControl appears in compact mode if container is less then 640 pixel wide', (t) => {
    const map = createMap();
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});
    map.addControl(new AttributionControl());

    const container = map.getContainer();

    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib:not(.compact)').length, 1);

    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
    map.resize();

    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib.compact').length, 1);
    t.end();
});

test('AttributionControl dedupes attributions that are substrings of others', (t) => {
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);

    map.on('load', () => {
        map.addSource('1', { type: 'vector', attribution: 'World' });
        map.addSource('2', { type: 'vector', attribution: 'Hello World' });
        map.addSource('3', { type: 'vector', attribution: 'Another Source' });
        map.addSource('4', { type: 'vector', attribution: 'Hello' });
        map.addSource('5', { type: 'vector', attribution: 'Hello World' });

    });

    let times = 0;
    map.on('data', (e) => {
        if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
            if (++times === 5) {
                t.equal(attribution._container.innerHTML, 'Hello World | Another Source');
                t.end();
            }
        }
    });
});

test('AttributionControl has the correct edit map link', (t) => {
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);

    map.on('load', () => {
        map.addSource('1', {type: 'vector', attribution: '<a class="mapbox-improve-map" href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>'});
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/map-feedback/#/0/0/1', 'edit link contains map location data');
                map.setZoom(2);
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/map-feedback/#/0/0/3', 'edit link updates on mapmove');
                t.end();
            }
        });
    });
});
