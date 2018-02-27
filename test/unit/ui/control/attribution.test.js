'use strict';

import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import config from '../../../../src/util/config';
import AttributionControl from '../../../../src/ui/control/attribution_control';

function createMap() {
    const container = window.document.createElement('div');
    config.ACCESS_TOKEN = 'pk.123';
    return new Map({
        container: container,
        attributionControl: false,
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

    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib.mapboxgl-compact').length, 1);
    map.removeControl(attributionControl);

    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
    attributionControl = new AttributionControl({
        compact: false
    });

    map.addControl(attributionControl);
    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib:not(.mapboxgl-compact)').length, 1);
    t.end();
});

test('AttributionControl appears in compact mode if container is less then 640 pixel wide', (t) => {
    const map = createMap();
    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 700, configurable: true});
    map.addControl(new AttributionControl());

    const container = map.getContainer();

    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib:not(.mapboxgl-compact)').length, 1);

    Object.defineProperty(map.getCanvasContainer(), 'offsetWidth', {value: 600, configurable: true});
    map.resize();

    t.equal(container.querySelectorAll('.mapboxgl-ctrl-attrib.mapboxgl-compact').length, 1);
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
        map.addSource('1', {type: 'vector', attribution: '<a class="mapbox-improve-map" href="https://www.mapbox.com/feedback/" target="_blank">Improve this map</a>'});
        map.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/feedback/?owner=mapbox&id=streets-v10&access_token=pk.123#/0/0/0', 'edit link contains map location data');
                map.setZoom(2);
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/feedback/?owner=mapbox&id=streets-v10&access_token=pk.123#/0/0/2', 'edit link updates on mapmove');
                t.end();
            }
        });
    });
});

test('AttributionControl is hidden if empty', (t) => {
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);
    map.on('load', () => {
        map.addSource('1', { type: 'vector' });
    });

    const container = map.getContainer();

    const checkEmptyFirst = () => {
        t.equal(attribution._container.innerHTML, '');
        t.equal(container.querySelectorAll('.mapboxgl-attrib-empty').length, 1, 'includes empty class when no attribution strings are provided');

        map.addSource('2', { type: 'vector', attribution: 'Hello World' });
    };

    const checkNotEmptyLater = () => {
        t.equal(attribution._container.innerHTML, 'Hello World');
        t.equal(container.querySelectorAll('.mapboxgl-attrib-empty').length, 0, 'removes empty class when source with attribution is added');
        t.end();
    };

    let times = 0;
    map.on('data', (e) => {
        if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
            times++;
            if (times === 1) {
                checkEmptyFirst();
            } else if (times === 2) {
                checkNotEmptyLater();
            }
        }
    });
});
