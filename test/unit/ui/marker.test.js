'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../src/util/window');
const Map = require('../../../src/ui/map');
const Marker = require('../../../src/ui/marker');
const Popup = require('../../../src/ui/popup');
const LngLat = require('../../../src/geo/lng_lat');
const Point = require('@mapbox/point-geometry');

function createMap() {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});
    return new Map({container: container});
}

test('Marker', (t) => {

    t.test('constructor', (t) => {
        const el = window.document.createElement('div');
        const marker = new Marker(el);
        t.ok(marker.getElement(), 'marker element is created');
        t.end();
    });

    t.test('default marker without element', (t) => {
        const marker = new Marker();
        t.ok(marker.getElement(), 'marker returns default element');
        t.ok(marker.getAnchor(), 'marker returns default  anchor option');
        t.ok(marker.getOffset(), 'marker returns default offset option');
        t.end();
    });

    t.test('marker with element', (t) => {
        const marker = new Marker(window.document.createElement('div'));
        t.ok(marker.getElement(), 'marker with custom element is created');
        t.end();
    });

    t.test('default marker with anchor', (t) => {
        const marker = new Marker();
        t.ok(marker.getElement(), 'marker returns default element');
        t.ok(marker.getAnchor(), 'marker returns default  anchor option');
        t.end();
    });

    t.test('default marker with offset', (t) => {
        const marker = new Marker();
        t.ok(marker.getElement(), 'marker returns default element');
        t.ok(marker.getOffset(), 'marker returns default offset option');
        t.end();
    });

    t.test('default marker with anchor and offset', (t) => {
        const marker = new Marker();
        t.ok(marker.getElement(), 'marker returns default element');
        t.ok(marker.getAnchor(), 'marker returns default  anchor option');
        t.ok(marker.getOffset(), 'marker returns default offset option');
        t.end();
    });

    t.test('default marker with some options', (t) => {
        const marker = new Marker(null, { anchor: 'bottom',  foo: 'bar' });
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getAnchor(), 'translate(-50%,-100%)', 'marker set with anchor options');
        t.ok(marker.getOffset(), 'translate(0px, 0px)', 'marker set with no offset uses default offset');
        t.end();
    });

    t.test('marker with custom anchor and offest', (t) => {
        const marker = new Marker(window.document.createElement('div'), { anchor: 'top-right', offset: [1, 2] });
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getAnchor(), 'translate(-100%, 0)', 'marker sets with supplied anchor');
        t.ok(marker.getOffset(), 'translate(1px, 2px)', 'marker sets with supplied offset');
        t.end();
    });

    t.test('marker is added to map', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]);
        t.ok(marker.addTo(map) instanceof Marker, 'marker.addTo(map) returns Marker instance');
        t.ok(marker._map, 'marker instance is bound to map instance');
        t.end();
    });

    t.test('marker\'s lngLat can be changed', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'),
            { anchor: 'top-left' })
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        t.ok(marker.setLngLat([-76, 39]) instanceof Marker, 'marker.setLngLat() returns Marker instance');
        const markerLngLat = marker.getLngLat();
        t.ok(markerLngLat.lng === -76 &&  markerLngLat.lat === 39, 'marker\'s position can be updated');
        t.end();
    });

    t.test('Marker anchors as specified by the default anchor option', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([-77.01866, 38.888]);

        t.ok(marker.addTo(map) instanceof Marker, 'marker.addTo(map) returns Marker instance');
        t.ok(marker._map, 'marker instance is bound to map instance');
        t.end();
    });

    [
        ['middle', 'translate(-50%, -50%)'],
        ['top-left', 'translate(0, 0)'],
        ['top', 'translate(-50%, 0)'],
        ['top-right', 'translate(-100%, 0) '],
        ['right', 'translate(-100%, -50%) '],
        ['bottom-right', 'translate(-100%, -100%)'],
        ['bottom', 'translate(-50%, -100%)'],
        ['bottom-left', 'translate(0, -100%)'],
        ['left', 'translate(0, -50%)'],
        ['bottom', 'translate(-50%, -100%)']
    ].forEach((args) => {
        const anchor = args[0];
        //const transform = args[1];

        t.test(`Marker automatically anchors to ${anchor}`, (t) => {
            const map = createMap();
            const marker = new Marker(window.document.createElement('div'))
                .setLngLat([0, 0])
                .addTo(map);

            Object.defineProperty(marker._element, 'offsetWidth', {value: 100});
            Object.defineProperty(marker._element, 'offsetHeight', {value: 100});

            t.stub(map, 'project');

            const anchorTranslate = {
                'middle': 'translate(-50%,-50%)',
                'top': 'translate(-50%,0)',
                'top-left': 'translate(0,0)',
                'top-right': 'translate(-100%,0)',
                'bottom': 'translate(-50%,-100%)',
                'bottom-left': 'translate(0,-100%)',
                'bottom-right': 'translate(-100%,-100%)',
                'left': 'translate(0,-50%)',
                'right': 'translate(-100%,-50%)'
            };

            t.ok(marker.getAnchor(this.anchor), 'marker sets with anchor ');
            t.ok(marker.getOffset(), 'default marker with supplied offset');

            for (const key in anchorTranslate) {
                marker._element.classList.remove(`mapboxgl-marker-anchor-${key}`);
            }

            marker._element.classList.add(`mapboxgl-marker-anchor-${this.anchor}`);

            t.ok(marker._element.classList.contains(`mapboxgl-marker-anchor-${this.anchor}`));
            t.end();
        });

        t.test(`Marker translation reflects offset and ${anchor} anchor`, (t) => {
            const map = createMap();
            t.stub(map, 'project');
            const marker = new Marker(window.document.createElement('div'),
                {anchor: anchor, offset: 10})
                .setLngLat([-77.01866, 38.888])
                .addTo(map);

            const anchorTranslate = {
                'middle': 'translate(-50%,-50%)',
                'top': 'translate(-50%,0)',
                'top-left': 'translate(0,0)',
                'top-right': 'translate(-100%,0)',
                'bottom': 'translate(-50%,-100%)',
                'bottom-left': 'translate(0,-100%)',
                'bottom-right': 'translate(-100%,-100%)',
                'left': 'translate(0,-50%)',
                'right': 'translate(-100%,-50%)'
            };

            t.ok(marker.getAnchor(this.anchor), 'marker sets with anchor ');
            t.ok(marker.getOffset(this.offset), 'default marker with supplied offset');

            for (const key in anchorTranslate) {
                marker._element.classList.remove(`${key}`);
            }

            t.equal(marker._element.style.transform, this.transform);
            t.end();
        });
    });

    t.test('Marker is offset via an object offset option', (t) => {
        const map = createMap();
        t.stub(map, 'project').returns(new Point(0, 0));
        //const transform = 'translate(-50%,-50%) translate(5px,10px)';
        const marker = new Marker(window.document.createElement('div'),
            {anchor: 'middle', offset: {'top-left': [5, 10]}})
            .setLngLat([0, 0])
            .addTo(map);

        t.ok(marker._element, 'translate(-50%,-50%) translate(5px,10px)');
        t.end();
    });

    t.test('marker centered by default and returns defaults for anchor and offset', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([0, 0])
            .addTo(map);

        t.ok(marker.getAnchor(), 'translate(-50%,-50%)');
        t.ok(marker.getOffset(), 'translate(256px, 256px)');
        t.ok(marker._element, 'translate(-50%,-50%) translate(256px, 256px)', 'Marker centered');
        t.end();
    });

    t.test('marker\'s anchor can be changed', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        t.ok(marker._element, 'translate(-50%,-50%) translate(256px, 256px)', 'Marker centered');
        t.ok(marker.setAnchor('top-left') instanceof Marker, 'marker.setAnchor() returns Marker instance');
        t.ok(marker._element, 'translate(0, 0) translate(256px, 256px)', 'marker\'s offset can be updated');
        t.end();
    });

    t.test('marker\'s offset can be changed', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        t.ok(marker._element, 'translate(-50%,-50%) translate(256px, 256px)', 'Marker centered');
        t.ok(marker.setOffset([50, -75]) instanceof Marker, 'marker.setOffset() returns Marker instance');
        t.ok(marker._element, 'translate(-50%,-50%) translate(50px, -75px)', 'marker\'s offset can be updated');
        t.end();
    });

    t.test('popups can be bound to marker instance', (t) => {
        const map = createMap();
        const popup = new Popup();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        marker.setPopup(popup);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with Popup instance');
        t.end();
    });

    t.test('popups can be unbound from a marker instance', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        marker.setPopup(new Popup());
        t.ok(marker.getPopup() instanceof Popup);
        t.ok(marker.setPopup() instanceof Marker, 'passing no argument to Marker.setPopup() is valid');
        t.ok(!marker.getPopup(), 'Calling setPopup with no argument successfully removes Popup instance from Marker instance');
        t.end();
    });

    t.test('popups can be set before LngLat', (t) => {
        const map = createMap();
        const popup = new Popup();
        new Marker()
            .setPopup(popup)
            .setLngLat([-77.01866, 38.888])
            .addTo(map);

        t.deepEqual(popup.getLngLat(), new LngLat(-77.01866, 38.888));
        t.end();
    });

    t.test('togglePopup returns Marker instance', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div'))
            .setLngLat([0, 0])
            .addTo(map);

        marker.setPopup(new Popup());
        t.ok(marker.togglePopup() instanceof Marker);
        t.end();
    });

    t.end();
});
