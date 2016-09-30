'use strict';

var test = require('tap').test;
var window = require('../../../../js/util/window');
var Map = require('../../../../js/ui/map');
var Attribution = require('../../../../js/ui/control/attribution');

function createMap() {
    return new Map({
        container: window.document.createElement('div'),
        attributionControl: false,
        style: {
            version: 8,
            sources: {},
            layers: []
        }
    });
}

test('Attribution appears in bottom-right by default', function (t) {
    var map = createMap();
    new Attribution()
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-bottom-right .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('Attribution appears in the position specified by the position option', function (t) {
    var map = createMap();
    new Attribution({position: 'top-left'})
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-attrib').length, 1);
    t.end();
});

test('Attribution dedupes attributions that are substrings of others', function (t) {
    var map = createMap();
    var attribution = new Attribution({position: 'top-left'}).addTo(map);

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
