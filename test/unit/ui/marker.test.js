import { test } from 'mapbox-gl-js-test';
import window from '../../../src/util/window';
import Map from '../../../src/ui/map';
import Marker from '../../../src/ui/marker';
import Popup from '../../../src/ui/popup';
import LngLat from '../../../src/geo/lng_lat';
import Point from '@mapbox/point-geometry';

function createMap() {
    const container = window.document.createElement('div');
    Object.defineProperty(container, 'offsetWidth', {value: 512});
    Object.defineProperty(container, 'offsetHeight', {value: 512});
    return new Map({container: container});
}

test('Marker uses a default marker element with an appropriate offset', (t) => {
    const marker = new Marker();
    t.ok(marker.getElement());
    t.ok(marker.getOffset().equals(new Point(0, -14)));
    t.end();
});

test('Marker uses a default marker element with custom color', (t) => {
    const marker = new Marker({ color: '#123456' });
    t.ok(marker.getElement().innerHTML.includes('#123456'));
    t.end();
});

test('Marker uses a default marker with custom offest', (t) => {
    const marker = new Marker({ offset: [1, 2] });
    t.ok(marker.getElement());
    t.ok(marker.getOffset().equals(new Point(1, 2)));
    t.end();
});

test('Marker uses the provided element', (t) => {
    const element = window.document.createElement('div');
    const marker = new Marker({element});
    t.equal(marker.getElement(), element);
    t.end();
});

test('Marker#addTo adds the marker element to the canvas container', (t) => {
    const map = createMap();
    new Marker()
        .setLngLat([-77.01866, 38.888])
        .addTo(map);

    t.equal(map.getCanvasContainer().querySelectorAll('.mapboxgl-marker').length, 1);

    map.remove();
    t.end();
});

test('Marker provides LngLat accessors', (t) => {
    t.equal(new Marker().getLngLat(), undefined);

    t.ok(new Marker().setLngLat([1, 2]).getLngLat() instanceof LngLat);
    t.deepEqual(new Marker().setLngLat([1, 2]).getLngLat(), new LngLat(1, 2));

    t.ok(new Marker().setLngLat(new LngLat(1, 2)).getLngLat() instanceof LngLat);
    t.deepEqual(new Marker().setLngLat(new LngLat(1, 2)).getLngLat(), new LngLat(1, 2));

    t.end();
});

test('Marker provides offset accessors', (t) => {
    t.ok(new Marker().setOffset([1, 2]).getOffset() instanceof Point);
    t.deepEqual(new Marker().setOffset([1, 2]).getOffset(), new Point(1, 2));

    t.ok(new Marker().setOffset(new Point(1, 2)).getOffset() instanceof Point);
    t.deepEqual(new Marker().setOffset(new Point(1, 2)).getOffset(), new Point(1, 2));

    t.end();
});

test('Marker#setPopup binds a popup', (t) => {
    const popup = new Popup();
    const marker = new Marker()
        .setPopup(popup);
    t.equal(marker.getPopup(), popup);
    t.end();
});

test('Marker#setPopup unbinds a popup', (t) => {
    const marker = new Marker()
        .setPopup(new Popup())
        .setPopup();
    t.ok(!marker.getPopup());
    t.end();
});

test('Marker#togglePopup opens a popup that was closed', (t) => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup())
        .togglePopup();

    t.ok(marker.getPopup().isOpen());

    map.remove();
    t.end();
});

test('Marker#togglePopup closes a popup that was open', (t) => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map)
        .setPopup(new Popup())
        .togglePopup()
        .togglePopup();

    t.ok(!marker.getPopup().isOpen());

    map.remove();
    t.end();
});

test('Marker anchor defaults to center', (t) => {
    const map = createMap();
    const marker = new Marker()
        .setLngLat([0, 0])
        .addTo(map);

    t.ok(marker.getElement().classList.contains('mapboxgl-marker-anchor-center'));
    t.match(marker.getElement().style.transform, /translate\(-50%,-50%\)/);

    map.remove();
    t.end();
});

test('Marker anchors as specified by the anchor option', (t) => {
    const map = createMap();
    const marker = new Marker({anchor: 'top'})
        .setLngLat([0, 0])
        .addTo(map);

    t.ok(marker.getElement().classList.contains('mapboxgl-marker-anchor-top'));
    t.match(marker.getElement().style.transform, /translate\(-50%,0\)/);

    map.remove();
    t.end();
});

test('Marker accepts backward-compatible constructor parameters', (t) => {
    const element = window.document.createElement('div');

    const m1 = new Marker(element);
    t.equal(m1.getElement(), element);

    const m2 = new Marker(element, { offset: [1, 2] });
    t.equal(m2.getElement(), element);
    t.ok(m2.getOffset().equals(new Point(1, 2)));
    t.end();
});

test('Popup offsets around default Marker', (t) => {
    const map = createMap();

    const marker = new Marker()
        .setLngLat([0, 0])
        .setPopup(new Popup().setText('Test'))
        .addTo(map);

    t.ok(marker.getPopup().options.offset.bottom[1] < 0, 'popup is vertically offset somewhere above the tip');
    t.ok(marker.getPopup().options.offset.top[1] === 0, 'popup is vertically offset at the tip');
    t.ok(marker.getPopup().options.offset.left[0] > 0, 'popup is horizontally offset somewhere to the right of the tip');
    t.ok(marker.getPopup().options.offset.right[0] < 0, 'popup is horizontally offset somewhere to the left of the tip');

    t.ok(marker.getPopup().options.offset['bottom-left'][0] > 0, 'popup is horizontally offset somewhere to the top right of the tip');
    t.ok(marker.getPopup().options.offset['bottom-left'][1] < 0, 'popup is vertically offset somewhere to the top right of the tip');
    t.ok(marker.getPopup().options.offset['bottom-right'][0] < 0, 'popup is horizontally offset somewhere to the top left of the tip');
    t.ok(marker.getPopup().options.offset['bottom-right'][1] < 0, 'popup is vertically offset somewhere to the top left of the tip');

    t.deepEqual(marker.getPopup().options.offset['top-left'], [0, 0], 'popup offset at the tip when below to the right');
    t.deepEqual(marker.getPopup().options.offset['top-right'], [0, 0], 'popup offset at the tip when below to the left');

    t.end();
});

test('Popup anchors around default Marker', (t) => {
    const map = createMap();

    const marker = new Marker()
        .setLngLat([0, 0])
        .setPopup(new Popup().setText('Test'))
        .addTo(map);

    // open the popup
    marker.togglePopup();

    const mapHeight = map.getContainer().offsetHeight;
    const markerTop = -marker.getPopup().options.offset.bottom[1]; // vertical distance from tip of marker to the top in pixels
    const markerRight = -marker.getPopup().options.offset.right[0]; // horizontal distance from the tip of the marker to the right in pixels

    // give the popup some height
    Object.defineProperty(marker.getPopup()._container, 'offsetWidth', {value: 100});
    Object.defineProperty(marker.getPopup()._container, 'offsetHeight', {value: 100});

    // marker should default to above since it has enough space
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-bottom'), 'popup anchors above marker');

    // move marker to the top forcing the popup to below
    marker.setLngLat(map.unproject([mapHeight / 2, markerTop]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-top'), 'popup anchors bolow marker');

    // move marker to the right forcing the popup to the left
    marker.setLngLat(map.unproject([mapHeight - markerRight, mapHeight / 2]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-right'), 'popup anchors left of marker');

    // move marker to the left forcing the popup to the right
    marker.setLngLat(map.unproject([markerRight, mapHeight / 2]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-left'), 'popup anchors right of marker');

    // move marker to the top left forcing the popup to the bottom right
    marker.setLngLat(map.unproject([markerRight, markerTop]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-top-left'), 'popup anchors bottom right of marker');

    // move marker to the top right forcing the popup to the bottom left
    marker.setLngLat(map.unproject([mapHeight - markerRight, markerTop]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-top-right'), 'popup anchors bottom left of marker');

    // move marker to the bottom left forcing the popup to the top right
    marker.setLngLat(map.unproject([markerRight, mapHeight]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-bottom-left'), 'popup anchors top right of marker');

    // move marker to the bottom right forcing the popup to the top left
    marker.setLngLat(map.unproject([mapHeight - markerRight, mapHeight]));
    t.ok(marker.getPopup()._container.classList.contains('mapboxgl-popup-anchor-bottom-right'), 'popup anchors top left of marker');

    t.end();
});
