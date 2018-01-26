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
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el);
        t.ok(marker.getElement(), 'marker element is created');
        t.end();
    });

    t.test('default marker', (t) => {
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el);
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getAnchor(), 'marker set with anchor to middle');
        t.ok(marker.getOffset(), 'default marker with no offset uses default marker offset');
        t.end();
    });

    t.test('default marker with some options', (t) => {
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el, { anchor: 'bottom',  foo: 'bar' });
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getAnchor(), 'marker set with anchor options');
        t.ok(marker.getOffset(), 'default marker with no offset uses default marker offset');
        t.end();
    });

    t.test('default marker with custom offest', (t) => {
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el, { offset: [1, 2] });
        t.ok(marker.getElement(), 'default marker is created');

        t.ok(marker.getAnchor(), 'marker sets with anchor ');
        t.ok(marker.getOffset().equals(new Point(1, 2)), 'default marker with supplied offset');
        t.end();
    });

    t.test('marker is added to map', (t) => {
        const map = createMap();
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el, { anchor: 'middle' }).setLngLat([-77.01866, 38.888]);
        t.ok(marker.addTo(map) instanceof Marker, 'marker.addTo(map) returns Marker instance');
        t.ok(marker._map, 'marker instance is bound to map instance');
        t.end();
    });

    t.test('marker\'s lngLat can be changed', (t) => {
        const map = createMap();
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el, { anchor: 'top-left' }).setLngLat([-77.01866, 38.888]).addTo(map);
        t.ok(marker.setLngLat([-76, 39]) instanceof Marker, 'marker.setLngLat() returns Marker instance');
        const markerLngLat = marker.getLngLat();
        t.ok(markerLngLat.lng === -76 &&  markerLngLat.lat === 39, 'marker\'s position can be updated');
        t.end();
    });

    test('Marker anchors as specified by the default anchor option', (t) => {
        const map = createMap();
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el, {anchor: 'middle'})
            .setLngLat([0, 0])
            .addTo(map);

        t.ok(marker._element.classList.contains(`mapboxgl-marker-anchor-middle`));
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
        const transform = args[1];

        test(`Marker automatically anchors to ${anchor}`, (t) => {
            const map = createMap();
            const el = window.document.createElement(`mapboxgl-marker`);
            const marker = new Marker(el)
                .setLngLat([0, 0])
                .addTo(map);

            Object.defineProperty(marker._element, 'offsetWidth', {value: 100});
            Object.defineProperty(marker._element, 'offsetHeight', {value: 100});

            t.stub(map, 'project');

            t.ok(marker._element.classList.contains(`mapboxgl-marker-anchor-${anchor}`));
            t.end();
        });

        test(`Marker translation reflects offset and ${anchor} anchor`, (t) => {
            const map = createMap();
            t.stub(map, 'project');

            const el = window.document.createElement(`mapboxgl-marker`);
            const marker = new Marker(el, {anchor: anchor, offset: 10})
                .setLngLat([0, 0])
                .addTo(map);

            t.equal(marker._element.style.transform, transform);
            t.end();
        });
    });

    test('marker automatically anchors to top if its bottom offset would push it off-screen', (t) => {
        const map = createMap();

        const options = {
            anchor: 'middle',
            offset: { 'bottom': [0, -25], 'top': [0, 0]}
        };

        const marker = new Marker(options)
            .setLngLat([0, 0])
            .addTo(map);

        Object.defineProperty(marker._element, 'offsetWidth', {value: 512});
        Object.defineProperty(marker._element, 'offsetHeight', {value: 512});

        t.stub(map, 'project');
        marker.setLngLat([0, 0]);

        t.ok(marker._element.classList.contains('mapboxgl-popup-anchor-top'));
        t.end();
    });

    test('marker is offset via a PointLike offset option', (t) => {
        const map = createMap();
        t.stub(map, 'project').returns(new Point(0, 0));

        const marker = new Marker({anchor: 'top-left', offset: [5, 10]})
            .setLngLat([0, 0])
            .addTo(map);

        t.equal(marker._element.style.transform, 'translate(0,0) translate(5px,10px)');
        t.end();
    });

    test('Marker is offset via an object offset option', (t) => {
        const map = createMap();
        t.stub(map, 'project').returns(new Point(0, 0));

        const marker = new Marker({anchor: 'top-left', offset: {'top-left': [5, 10]}})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        t.equal(marker._element.style.transform, 'translate(0,0) translate(5px,10px)');
        t.end();
    });

    test('marker is offset via an incomplete object offset option', (t) => {
        const map = createMap();
        t.stub(map, 'project').returns(new Point(0, 0));

        const marker = new Marker({anchor: 'top-right', offset: {'top-left': [5, 10]}})
            .setLngLat([0, 0])
            .addTo(map);

        t.equal(marker._element.style.transform, 'translate(-100%,0) translate(0px,0px)');
        t.end();
    });

    t.test('popups can be bound to marker instance', (t) => {
        const map = createMap();
        const popup = new Popup();
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(popup);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with Popup instance');
        t.end();
    });

    t.test('popups can be unbound from a marker instance', (t) => {
        const map = createMap();
        const el = window.document.createElement(`mapboxgl-marker`);
        const marker = new Marker(el).setLngLat([-77.01866, 38.888]).addTo(map);
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
        const element = window.document.createElement('div');
        const marker = new Marker(element).setLngLat([0, 0]).addTo(map);
        marker.setPopup(new Popup());
        t.ok(marker.togglePopup() instanceof Marker);
        t.end();
    });

    t.test('marker\'s offset can be changed', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        const offset = marker.getOffset();
        t.ok(offset.x === 0 && offset.y === 0, 'default offset');
        t.ok(marker.setOffset([50, -75]) instanceof Marker, 'marker.setOffset() returns Marker instance');
        const newOffset = marker.getOffset();
        t.ok(newOffset.x === 50 &&  newOffset.y === -75, 'marker\'s offset can be updated');
        t.end();
    });

    t.end();
});
