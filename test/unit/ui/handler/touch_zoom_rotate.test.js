import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('TouchZoomRotateHandler fires zoomstart, zoom, and zoomend events at appropriate times in response to a pinch-zoom gesture', (t) => {
    const map = createMap();

    const zoomstart = t.spy();
    const zoom      = t.spy();
    const zoomend   = t.spy();

    map.on('zoomstart', zoomstart);
    map.on('zoom',      zoom);
    map.on('zoomend',   zoomend);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: -5}, {clientX: 0, clientY: 5}]});
    map._updateCamera();
    t.equal(zoomstart.callCount, 0);
    t.equal(zoom.callCount, 0);
    t.equal(zoomend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: -10}, {clientX: 0, clientY: 10}]});
    map._updateCamera();
    t.equal(zoomstart.callCount, 1);
    t.equal(zoom.callCount, 1);
    t.equal(zoomend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: -5}, {clientX: 0, clientY: 5}]});
    map._updateCamera();
    t.equal(zoomstart.callCount, 1);
    t.equal(zoom.callCount, 2);
    t.equal(zoomend.callCount, 0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._updateCamera();
    t.equal(zoomstart.callCount, 1);
    t.equal(zoom.callCount, 2);
    t.equal(zoomend.callCount, 1);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a pinch-rotate gesture', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: -5}, {clientX: 0, clientY: 5}]});
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: -5, clientY: 0}, {clientX: 5, clientY: 0}]});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: -5}, {clientX: 0, clientY: 5}]});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('TouchZoomRotateHandler does not begin a gesture if preventDefault is called on the touchstart event', (t) => {
    const map = createMap();

    map.on('touchstart', e => e.preventDefault());

    const move = t.spy();
    map.on('move', move);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 5, clientY: 0}]});
    map._updateCamera();

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 5}]});
    map._updateCamera();

    simulate.touchend(map.getCanvas(), {touches: []});
    map._updateCamera();

    t.equal(move.callCount, 0);

    map.remove();
    t.end();
});
