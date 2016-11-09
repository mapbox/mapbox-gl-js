'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../../js/util/window');
const Map = require('../../../../js/ui/map');
const AttributionControl = require('../../../../js/ui/control/attribution_control');

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
    map.addControl(new AttributionControl(), 'bottom-right');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('AttributionControl appears in the position specified by the position option', (t) => {
    const map = createMap();
    map.addControl(new AttributionControl(), 'top-left');

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-attrib').length, 1);
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
    map.on('data', (event) => {
        if (event.dataType === 'source' && ++times === 5) {
            t.equal(attribution._container.innerHTML, 'Hello World | Another Source');
            t.end();
        }
    });
});

test('AttributionControl has the correct edit map link', (t) => {
    const map = createMap();
    const attribution = new AttributionControl();
    map.addControl(attribution);

    map.on('load', () => {
        map.addSource('1', {type: 'vector', attribution: '<a class="mapbox-improve-map" href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>'});
        map.on('data', (event) => {
            if (event.dataType === 'source') {
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/map-feedback/#/0/0/1', 'edit link contains map location data');
                map.setZoom(2);
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/map-feedback/#/0/0/3', 'edit link updates on mapmove');
                t.end();
            }
        });
    });
});
