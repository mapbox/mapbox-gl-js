'use strict';

var test = require('tap').test;
var jsdom = require('jsdom');

var extend = require('../../../js/util/util').extend;
var Map = require('../../../js/ui/map');
var Marker = require('../../../js/ui/marker');
var Popup = require('../../../js/ui/popup');

function prepareDOM(html) {
    html = html || '<!doctype html><html><body><div id="map"></div></body></html>';
    if (typeof document !== 'undefined') {
        return;
    }
    global.document = jsdom.jsdom(html);
    global.window = global.document.defaultView;
    global.navigator = {
        userAgent: 'JSDOM'
    };
    global.HTMLElement = global.window.HTMLElement;

}

function createMap(options, callback) {
    var map = new Map(extend({
        container: 'map',
        attributionControl: false,
        trackResize: true,
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    }, options));

    if (callback) map.on('load', function () {
        callback(null, map);
    });

    return map;
}



test('Marker', function (t) {
    t.test('constructor', function (t) {
        prepareDOM();
        var el = document.createElement('div');
        var marker = new Marker(el);
        t.ok(marker.getElement(), 'marker element is created');
        t.end();
    });

    t.test('marker is added to map', function (t) {
        prepareDOM();
        var map = createMap();
        var el = document.createElement('div');

        map.on('load', function () {
            var marker = new Marker(el).setLngLat([-77.01866, 38.888]);
            t.ok(marker.addTo(map) instanceof Marker, 'marker.addTo(map) returns Marker instance');
            t.ok(marker._map, 'marker instance is bound to map instance');
            t.end();
        });


    });

    t.test('popups can be bound to marker instance', function (t) {
        prepareDOM();
        var map = createMap();
        var el = document.createElement('div');
        var popup = new Popup();
        var marker = new Marker(el).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.bindPopup(popup);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with Popup instance');

        marker.bindPopup('<h1>pop</h1>');
        t.ok(marker.getPopup() instanceof Popup, 'popup created with HTML string');

        el.text = 'pop pop';
        marker.bindPopup(el);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with HTMLElement');

        t.end();
    });

    t.end();
});

