'use strict';

var test = require('mapbox-gl-js-test').test;
var window = require('../../../../js/util/window');
var Map = require('../../../../js/ui/map');
var AttributionControl = require('../../../../js/ui/control/attribution_control');

function createMap() {
    var container = window.document.createElement('div');
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

test('AttributionControl appears in bottom-right by default', function (t) {
    var map = createMap();
    new AttributionControl()
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('AttributionControl appears in the position specified by the position option', function (t) {
    var map = createMap();
    new AttributionControl({position: 'top-left'})
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('AttributionControl dedupes attributions that are substrings of others', function (t) {
    var map = createMap();
    var attribution = new AttributionControl({position: 'top-left'}).addTo(map);

    map.on('load', function() {
        map.addSource('1', { type: 'vector', attribution: 'World' });
        map.addSource('2', { type: 'vector', attribution: 'Hello World' });
        map.addSource('3', { type: 'vector', attribution: 'Another Source' });
        map.addSource('4', { type: 'vector', attribution: 'Hello' });
        map.addSource('5', { type: 'vector', attribution: 'Hello World' });

    });

    var times = 0;
    map.on('data', function(event) {
        if (event.dataType === 'source' && ++times === 5) {
            t.equal(attribution._container.innerHTML, 'Hello World | Another Source');
            t.end();
        }
    });
});

test('AttributionControl has the correct edit map link', function (t) {
    var map = createMap();
    var attribution = new AttributionControl({position: 'top-left'}).addTo(map);

    map.on('load', function () {
        map.addSource('1', {type: 'vector', attribution: '<a class="mapbox-improve-map" href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>'});
        map.on('data', function (event) {
            if (event.dataType === 'source') {
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/map-feedback/#/0/0/1', 'edit link contains map location data');
                map.setZoom(2);
                t.equal(attribution._editLink.href, 'https://www.mapbox.com/map-feedback/#/0/0/3', 'edit link updates on mapmove');
                t.end();
            }
        });
    });
});
