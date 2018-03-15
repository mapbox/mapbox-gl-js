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

test('Marker', (t) => {
    t.test('constructor', (t) => {
        const el = window.document.createElement('div');
        const marker = new Marker(el);
        t.ok(marker.getElement(), 'marker element is created');
        t.end();
    });

    t.test('default marker', (t) => {
        const marker = new Marker();
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getOffset().equals(new Point(0, -14)), 'default marker with no offset uses default marker offset');
        t.end();
    });

    t.test('default marker with some options', (t) => {
        const marker = new Marker(null, { foo: 'bar' });
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getOffset().equals(new Point(0, -14)), 'default marker with no offset uses default marker offset');
        t.end();
    });

    t.test('default marker with custom offest', (t) => {
        const marker = new Marker(null, { offset: [1, 2] });
        t.ok(marker.getElement(), 'default marker is created');
        t.ok(marker.getOffset().equals(new Point(1, 2)), 'default marker with supplied offset');
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
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        t.ok(marker.setLngLat([-76, 39]) instanceof Marker, 'marker.setLngLat() returns Marker instance');
        const markerLngLat = marker.getLngLat();
        t.ok(markerLngLat.lng === -76 &&  markerLngLat.lat === 39, 'marker\'s position can be updated');
        t.end();
    });

    t.test('popups can be bound to marker instance', (t) => {
        const map = createMap();
        const popup = new Popup();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(popup);
        t.ok(marker.getPopup() instanceof Popup, 'popup created with Popup instance');
        t.end();
    });

    t.test('popups can be unbound from a marker instance', (t) => {
        const map = createMap();
        const marker = new Marker(window.document.createElement('div')).setLngLat([-77.01866, 38.888]).addTo(map);
        marker.setPopup(new Popup());
        t.ok(marker.getPopup() instanceof Popup);
        t.ok(marker.setPopup() instanceof Marker, 'passing no argument to Marker.setPopup() is valid');
        t.ok(!marker.getPopup(), 'Calling setPopup with no argument successfully removes Popup instance from Marker instance');
        t.end();
    });

    t.test('popups can be set before LngLat', (t) => {
        const map = createMap();
        const popup = new Popup();
        new Marker(window.document.createElement('div'))
            .setPopup(popup)
            .setLngLat([-77.01866, 38.888])
            .addTo(map);
        t.deepEqual(popup.getLngLat(), new LngLat(-77.01866, 38.888));
        t.end();
    });

    t.test('marker centered by default', (t) => {
        const map = createMap();
        const element = window.document.createElement('div');
        const marker = new Marker(element).setLngLat([0, 0]).addTo(map);
        const translate = Math.round(map.getContainer().offsetWidth / 2);
        t.equal(marker.getElement().style.transform, `translate(-50%, -50%) translate(${translate}px, ${translate}px)`, 'Marker centered');
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
