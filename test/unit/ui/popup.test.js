import {test} from '../../util/test';
import window from '../../../src/util/window';
import {createMap as globalCreateMap} from '../../util';
import Popup from '../../../src/ui/popup';
import LngLat from '../../../src/geo/lng_lat';
import Point from '@mapbox/point-geometry';
import simulate from '../../util/simulate_interaction';

const containerWidth = 512;
const containerHeight = 512;

function createMap(t, options) {
    options = options || {};
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'clientWidth', {value: options.width || containerWidth});
    Object.defineProperty(container, 'clientHeight', {value: options.height || containerHeight});
    return globalCreateMap(t, {container});
}

test('Popup#getElement returns a .mapboxgl-popup element', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    t.ok(popup.isOpen());
    t.ok(popup.getElement().classList.contains('mapboxgl-popup'));
    t.end();
});

test('Popup#addTo adds a .mapboxgl-popup element', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    t.ok(popup.isOpen());
    t.equal(map.getContainer().querySelectorAll('.mapboxgl-popup').length, 1);
    t.end();
});

test('Popup closes on map click events by default', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    simulate.click(map.getCanvas());

    t.ok(!popup.isOpen());
    t.end();
});

test('Popup does not close on map click events when the closeOnClick option is false', (t) => {
    const map = createMap(t);
    const popup = new Popup({closeOnClick: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    simulate.click(map.getCanvas());

    t.ok(popup.isOpen());
    t.end();
});

test('Popup closes on close button click events', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    simulate.click(map.getContainer().querySelector('.mapboxgl-popup-close-button'));

    t.ok(!popup.isOpen());
    t.end();
});

test('Popup has no close button if closeButton option is false', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    t.equal(popup.getElement().querySelectorAll('.mapboxgl-popup-close-button').length, 0);
    t.end();
});

test('Popup fires close event when removed', (t) => {
    const map = createMap(t);
    const onClose = t.spy();

    new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .on('close', onClose)
        .addTo(map)
        .remove();

    t.ok(onClose.called);
    t.end();
});

test('Popup fires open event when added', (t) => {
    const map = createMap(t);
    const onOpen = t.spy();

    new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .on('open', onOpen)
        .addTo(map);

    t.ok(onOpen.called);
    t.end();
});

test('Popup content can be set via setText', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setText('Test');

    t.equal(popup.getElement().textContent, 'Test');
    t.end();
});

test('Popup content can be set via setHTML', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    t.equal(popup.getElement().querySelector('.mapboxgl-popup-content').innerHTML, "<span>Test</span>");
    t.end();
});

test('Popup width maximum defaults to 240px', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    t.equal(popup.getMaxWidth(), '240px');
    t.end();
});

test('Popup width maximum can be set via using maxWidth option', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false, maxWidth: '5px'})
        .setLngLat([0, 0])
        .addTo(map)
        .setHTML("<span>Test</span>");

    t.equal(popup.getMaxWidth(), '5px');
    t.end();
});

test('Popup width maximum can be set via maxWidth', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .setHTML("<span>Test</span>")
        .setMaxWidth('5px')
        .addTo(map);

    t.equal(popup.getMaxWidth(), '5px');
    t.end();
});

test('Popup content can be set via setDOMContent', (t) => {
    const map = createMap(t);
    const content = window.document.createElement('span');

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setDOMContent(content);

    t.equal(popup.getElement().querySelector('.mapboxgl-popup-content').firstChild, content);
    t.end();
});

test('Popup#setText protects against XSS', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map)
        .setText("<script>alert('XSS')</script>");

    t.equal(popup.getElement().textContent, "<script>alert('XSS')</script>");
    t.end();
});

test('Popup content setters overwrite previous content', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setLngLat([0, 0])
        .addTo(map);

    popup.setText('Test 1');
    t.equal(popup.getElement().textContent, 'Test 1');

    popup.setHTML('Test 2');
    t.equal(popup.getElement().textContent, 'Test 2');

    popup.setDOMContent(window.document.createTextNode('Test 3'));
    t.equal(popup.getElement().textContent, 'Test 3');

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

test('Popup is positioned at the specified LngLat in a world copy', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([270, 0])
        .setText('Test')
        .addTo(map);

    t.deepEqual(popup._pos, map.project([270, 0]));
    t.end();
});

test('Popup preserves object constancy of position after map move', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([270, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
    t.deepEqual(popup._pos, map.project([270, 0]));

    map.setCenter([-20, 0]); // longitude bounds: [-380, 340]
    t.deepEqual(popup._pos, map.project([270, 0]));

    t.end();
});

test('Popup preserves object constancy of position after auto-wrapping center (left)', (t) => {
    const map = createMap(t, {width: 1024});
    map.setCenter([-175, 0]); // longitude bounds: [-535, 185]

    const popup = new Popup()
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([175, 0]); // longitude bounds: [-185, 535]
    t.deepEqual(popup._pos, map.project([360, 0]));

    t.end();
});

test('Popup preserves object constancy of position after auto-wrapping center (right)', (t) => {
    const map = createMap(t, {width: 1024});
    map.setCenter([175, 0]); // longitude bounds: [-185, 535]

    const popup = new Popup()
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([-175, 0]); // longitude bounds: [-185, 535]
    t.deepEqual(popup._pos, map.project([-360, 0]));

    t.end();
});

test('Popup wraps position after map move if it would otherwise go offscreen (right)', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([-355, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([10, 0]); // longitude bounds: [-350, 370]
    t.deepEqual(popup._pos, map.project([5, 0]));
    t.end();
});

test('Popup wraps position after map move if it would otherwise go offscreen (right)', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([355, 0])
        .setText('Test')
        .addTo(map);

    map.setCenter([-10, 0]); // longitude bounds: [-370, 350]
    t.deepEqual(popup._pos, map.project([-5, 0]));
    t.end();
});

test('Popup is repositioned at the specified LngLat', (t) => {
    const map = createMap(t, {width: 1024}); // longitude bounds: [-360, 360]

    const popup = new Popup()
        .setLngLat([270, 0])
        .setText('Test')
        .addTo(map)
        .setLngLat([0, 0]);

    t.deepEqual(popup._pos, map.project([0, 0]));
    t.end();
});

test('Popup anchors as specified by the anchor option', (t) => {
    const map = createMap(t);
    const popup = new Popup({anchor: 'top-left'})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.ok(popup.getElement().classList.contains('mapboxgl-popup-anchor-top-left'));
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
        const map = createMap(t);
        const popup = new Popup()
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        Object.defineProperty(popup.getElement(), 'offsetWidth', {value: 100});
        Object.defineProperty(popup.getElement(), 'offsetHeight', {value: 100});

        t.stub(map, 'project').returns(point);
        popup.setLngLat([0, 0]);

        t.ok(popup.getElement().classList.contains(`mapboxgl-popup-anchor-${anchor}`));
        t.end();
    });

    test(`Popup translation reflects offset and ${anchor} anchor`, (t) => {
        const map = createMap(t);
        t.stub(map, 'project').returns(new Point(0, 0));

        const popup = new Popup({anchor, offset: 10})
            .setLngLat([0, 0])
            .setText('Test')
            .addTo(map);

        t.equal(popup.getElement().style.transform, transform);
        t.end();
    });
});

test('Popup automatically anchors to top if its bottom offset would push it off-screen', (t) => {
    const map = createMap(t);
    const point = new Point(containerWidth / 2, containerHeight / 2);
    const options = {offset: {
        'bottom': [0, -25],
        'top': [0, 0]
    }};
    const popup = new Popup(options)
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    Object.defineProperty(popup.getElement(), 'offsetWidth', {value: containerWidth / 2});
    Object.defineProperty(popup.getElement(), 'offsetHeight', {value: containerHeight / 2});

    t.stub(map, 'project').returns(point);
    popup.setLngLat([0, 0]);

    t.ok(popup.getElement().classList.contains('mapboxgl-popup-anchor-top'));
    t.end();
});

test('Popup is offset via a PointLike offset option', (t) => {
    const map = createMap(t);
    t.stub(map, 'project').returns(new Point(0, 0));

    const popup = new Popup({anchor: 'top-left', offset: [5, 10]})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.equal(popup.getElement().style.transform, 'translate(0,0) translate(5px,10px)');
    t.end();
});

test('Popup is offset via an object offset option', (t) => {
    const map = createMap(t);
    t.stub(map, 'project').returns(new Point(0, 0));

    const popup = new Popup({anchor: 'top-left', offset: {'top-left': [5, 10]}})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.equal(popup.getElement().style.transform, 'translate(0,0) translate(5px,10px)');
    t.end();
});

test('Popup is offset via an incomplete object offset option', (t) => {
    const map = createMap(t);
    t.stub(map, 'project').returns(new Point(0, 0));

    const popup = new Popup({anchor: 'top-right', offset: {'top-left': [5, 10]}})
        .setLngLat([0, 0])
        .setText('Test')
        .addTo(map);

    t.equal(popup.getElement().style.transform, 'translate(-100%,0) translate(0px,0px)');
    t.end();
});

test('Popup can be removed and added again (#1477)', (t) => {
    const map = createMap(t);

    new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map)
        .remove()
        .addTo(map);

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-popup').length, 1);
    t.end();
});

test('Popup#addTo is idempotent (#1811)', (t) => {
    const map = createMap(t);

    const popup = new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map)
        .addTo(map);

    t.equal(popup.getElement().querySelector('.mapboxgl-popup-content').textContent, 'Test');
    t.end();
});

test('Popup#remove is idempotent (#2395)', (t) => {
    const map = createMap(t);

    new Popup({closeButton: false})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map)
        .remove()
        .remove();

    t.equal(map.getContainer().querySelectorAll('.mapboxgl-popup').length, 0);
    t.end();
});

test('Popup adds classes from className option, methods for class manipulations works properly', (t) => {
    const map = createMap(t);
    const popup = new Popup({className: 'some classes'})
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    const popupContainer = popup.getElement();
    t.ok(popupContainer.classList.contains('some'));
    t.ok(popupContainer.classList.contains('classes'));

    popup.addClassName('addedClass');
    t.ok(popupContainer.classList.contains('addedClass'));

    popup.removeClassName('addedClass');
    t.ok(!popupContainer.classList.contains('addedClass'));

    popup.toggleClassName('toggle');
    t.ok(popupContainer.classList.contains('toggle'));

    popup.toggleClassName('toggle');
    t.ok(!popupContainer.classList.contains('toggle'));

    t.throws(() => popup.addClassName('should throw exception'), window.DOMException);
    t.throws(() => popup.removeClassName('should throw exception'), window.DOMException);
    t.throws(() => popup.toggleClassName('should throw exception'), window.DOMException);

    t.throws(() => popup.addClassName(''), window.DOMException);
    t.throws(() => popup.removeClassName(''), window.DOMException);
    t.throws(() => popup.toggleClassName(''), window.DOMException);

    t.end();
});

test('Cursor-tracked popup disappears on mouseout', (t) => {
    const map = createMap(t);

    const popup = new Popup()
        .setText("Test")
        .trackPointer()
        .addTo(map);

    t.equal(popup._trackPointer, true);
    t.end();
});

test('Pointer-tracked popup is tagged with right class', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .trackPointer()
        .addTo(map);

    t.equal(popup._container.classList.value.includes('mapboxgl-popup-track-pointer'), true);
    t.end();
});

test('Pointer-tracked popup with content set later is tagged with right class ', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .trackPointer()
        .addTo(map);

    popup.setText("Test");

    t.equal(popup._container.classList.value.includes('mapboxgl-popup-track-pointer'), true);
    t.end();
});

test('Pointer-tracked popup that is set afterwards is tagged with right class ', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .addTo(map);

    popup.setText("Test");
    popup.trackPointer();

    t.equal(popup._container.classList.value.includes('mapboxgl-popup-track-pointer'), true);
    t.end();
});

test('Pointer-tracked popup can be repositioned with setLngLat', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .trackPointer()
        .setLngLat([0, 0])
        .addTo(map);

    t.deepEqual(popup._pos, map.project([0, 0]));
    t.equal(popup._container.classList.value.includes('mapboxgl-popup-track-pointer'), false);
    t.end();
});

test('Positioned popup lacks pointer-tracking class', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .addTo(map);

    t.equal(popup._container.classList.value.includes('mapboxgl-popup-track-pointer'), false);
    t.end();
});

test('Positioned popup can be set to track pointer', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText("Test")
        .setLngLat([0, 0])
        .trackPointer()
        .addTo(map);

    simulate.mousemove(map.getCanvas(), {screenX:0, screenY:0});
    t.deepEqual(popup._pos, {x:0, y:0});
    t.end();
});

test('Popup closes on Map#remove', (t) => {
    const map = createMap(t);
    const popup = new Popup()
        .setText('Test')
        .setLngLat([0, 0])
        .addTo(map);

    map.remove();

    t.ok(!popup.isOpen());
    t.end();
});
