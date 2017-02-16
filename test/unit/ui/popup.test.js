'use strict';

const test = require('mapbox-gl-js-test').test;
const window = require('../../../src/util/window');
const Map = require('../../../src/ui/map');
const Popup = require('../../../src/ui/popup');
const LngLat = require('../../../src/geo/lng_lat');
const Point = require('point-geometry');
const simulateClick = require('mapbox-gl-js-test/simulate_interaction').click;

const containerWidth = 512;
const containerHeight = 512;

function createMap() {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: containerWidth});
    Object.defineProperty(container, 'offsetHeight', {value: containerHeight});
    return new Map({container: container});
}

test('Popup#addTo adds a .mapboxgl-popup element', (t) => {
    const map = createMap();
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    t.ok(popup.isOpen());
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-popup').length, 1);
    t.end();
});

test('Popup closes on map click events by default', (t) => {
    const map = createMap();
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    simulateClick(map.getCanvas());

    t.ok(!popup.isOpen());
    t.end();
});

test('Popup does not close on map click events when the closeOnClick option is false', (t) => {
    const map = createMap();
    const popup = new Popup({closeOnClick: false})
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    simulateClick(map.getCanvas());

    t.ok(popup.isOpen());
    t.end();
});

test('Popup closes on close button click events', (t) => {
    const map = createMap();
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    simulateClick(map.getContainer().querySelector('.mapboxgl-popup-close-button'));

    t.ok(!popup.isOpen());
    t.end();
});

test('Popup has no close button if closeButton option is false', (t) => {
    const map = createMap();

    new Popup({closeButton: false})
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-popup-close-button').length, 0);
    t.end();
});

test('Popup fires close event when removed', (t) => {
    const map = createMap();
    const onClose = t.spy();

    new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .on('close', onClose)
        .addTo(map)
        .remove();

    t.ok(onClose.called);
    t.end();
});

test('Popup content can be set via setText', (t) => {
    const map = createMap();

    new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setText("Test");

    t.equal(map.getContainer().querySelector('.mapboxgl-popup').textContent, "Test");
    t.end();
});

test('Popup content can be set via setHTML', (t) => {
    const map = createMap();

    new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    t.equal(map.getContainer().querySelector('.mapboxgl-popup-content').innerHTML, "<span>Test</span>");
    t.end();
});

test('Popup content can be set via setDOMContent', (t) => {
    const map = createMap();
    const content = window.document.createElement('span');

    new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setDOMContent(content);

    t.equal(map.getContainer().querySelector('.mapboxgl-popup-content').firstChild, content);
    t.end();
});

test('Popup#setText protects against XSS', (t) => {
    const map = createMap();

    new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setText("<script>alert('XSS')</script>");

    t.equal(map.getContainer().querySelector('.mapboxgl-popup').textContent, "<script>alert('XSS')</script>");
    t.end();
});

test('Popup content setters overwrite previous content', (t) => {
    const map = createMap();

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map);

    popup.setText("Test 1");
    t.equal(map.getContainer().querySelector('.mapboxgl-popup').textContent, "Test 1");

    popup.setHTML("Test 2");
    t.equal(map.getContainer().querySelector('.mapboxgl-popup').textContent, "Test 2");

    popup.setDOMContent(window.document.createTextNode("Test 3"));
    t.equal(map.getContainer().querySelector('.mapboxgl-popup').textContent, "Test 3");

    t.end();
});

test('Popup provides LngLat accessors', (t) => {
    t.equal(new Popup().getLngLat(), undefined);

    t.ok(new Popup().setLngLat([1, 2]).getLngLat() instanceof LngLat);
    t.deepEqual(new Popup().setLngLat([1, 2]).getLngLat(), new LngLat(1, 2));

    t.ok(new Popup().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat);
    t.deepEqual(new Popup().setLngLat(new LngLat(1, 2)).getLngLat(), new LngLat(1, 2));

    t.end();
});

test('Popup anchors as specified by the anchor option', (t) => {
    const map = createMap();
    const popup = new Popup({anchor: 'top-left'})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.ok(popup._container.classList.contains('mapboxgl-popup-anchor-top-left'));
    t.end();
});

[
    ['top-left',     new Point(10, 10),                                     'translate(0,0) translate(7px,7px)'],
    ['top',          new Point(containerWidth / 2, 10),                     'translate(-50%,0) translate(0px,10px)'],
    ['top-right',    new Point(containerWidth - 10, 10),                    'translate(-100%,0) translate(-7px,7px)'],
    ['right',        new Point(containerWidth - 10, containerHeight / 2),   'translate(-100%,-50%) translate(-10px,0px)'],
    ['bottom-right', new Point(containerWidth - 10, containerHeight - 10),  'translate(-100%,-100%) translate(-7px,-7px)'],
    ['bottom',       new Point(containerWidth / 2, containerHeight - 10),   'translate(-50%,-100%) translate(0px,-10px)'],
    ['bottom-left',  new Point(10, containerHeight - 10),                   'translate(0,-100%) translate(7px,-7px)'],
    ['left',         new Point(10, containerHeight / 2),                    'translate(0,-50%) translate(10px,0px)'],
    ['bottom',       new Point(containerWidth / 2, containerHeight / 2),    'translate(-50%,-100%) translate(0px,-10px)']
].forEach((args) => {
    const anchor = args[0];
    const point = args[1];
    const transform = args[2];

    test(`Popup automatically anchors to ${anchor}`, (t) => {
        const map = createMap();
        const popup = new Popup()
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        Object.defineProperty(popup._container, 'offsetWidth', {value: 100});
        Object.defineProperty(popup._container, 'offsetHeight', {value: 100});

        t.stub(map, 'project', () => { return point; });
        popup.setLngLat([0, 0]);

        t.ok(popup._container.classList.contains(`mapboxgl-popup-anchor-${anchor}`));
        t.end();
    });

    test(`Popup translation reflects offset and ${anchor} anchor`, (t) => {
        const map = createMap();
        t.stub(map, 'project', () => { return new Point(0, 0); });

        const popup = new Popup({anchor: anchor, offset: 10})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        t.equal(popup._container.style.transform, transform);
        t.end();
    });
});

test('Popup automatically anchors to top if its bottom offset would push it off-screen', (t) => {
    const map = createMap();
    const point = new Point(containerWidth / 2, containerHeight / 2);
    const options = { offset: {
        'bottom': [0, -25],
        'top': [0, 0]
    }};
    const popup = new Popup(options)
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    Object.defineProperty(popup._container, 'offsetWidth', {value: containerWidth / 2});
    Object.defineProperty(popup._container, 'offsetHeight', {value: containerHeight / 2});

    t.stub(map, 'project', () => { return point; });
    popup.setLngLat([0, 0]);

    t.ok(popup._container.classList.contains('mapboxgl-popup-anchor-top'));
    t.end();
});

test('Popup is offset via a PointLike offset option', (t) => {
    const map = createMap();
    t.stub(map, 'project', () => { return new Point(0, 0); });

    const popup = new Popup({anchor: 'top-left', offset: [5, 10]})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.equal(popup._container.style.transform, 'translate(0,0) translate(5px,10px)');
    t.end();
});

test('Popup is offset via an object offset option', (t) => {
    const map = createMap();
    t.stub(map, 'project', () => { return new Point(0, 0); });

    const popup = new Popup({anchor: 'top-left', offset: {'top-left': [5, 10]}})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.equal(popup._container.style.transform, 'translate(0,0) translate(5px,10px)');
    t.end();
});

test('Popup is offset via an incomplete object offset option', (t) => {
    const map = createMap();
    t.stub(map, 'project', () => { return new Point(0, 0); });

    const popup = new Popup({anchor: 'top-right', offset: {'top-left': [5, 10]}})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.equal(popup._container.style.transform, 'translate(-100%,0) translate(0px,0px)');
    t.end();
});

test('Popup can be removed and added again (#1477)', (t) => {
    const map = createMap();

    new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map)
        .remove()
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-popup').length, 1);
    t.end();
});

test('Popup#addTo is idempotent (#1811)', (t) => {
    const map = createMap();

    new Popup({closeButton: false})
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map)
        .addTo(map);

    t.equal(map.getContainer().querySelector('.mapboxgl-popup-content').textContent, "Test");
    t.end();
});
