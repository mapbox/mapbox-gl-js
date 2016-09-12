'use strict';

var test = require('tap').test;
var window = require('../../../../js/util/window');
var Map = require('../../../../js/ui/map');
var Attribution = require('../../../../js/ui/control/attribution');

function createMap() {
    return new Map({
        container: window.document.createElement('div'),
        attributionControl: false
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
    var mockSources = {};
    [
        'World',
        'Hello World',
        'Another Source',
        'Hello',
        'Hello World'
    ].forEach(function (s, i) {
        mockSources['source-' + i] = { attribution: s };
    });

    var expected = 'Hello World | Another Source';
    var actual = Attribution.createAttributionString(mockSources);
    t.same(actual, expected, 'deduped attributions string');
    t.end();
});
