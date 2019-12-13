import {test} from '../../../util/test';
import { TouchZoomHandler } from '../../../../src/ui/handler/touch';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import window from '../../../../src/util/window';
import simulate from '../../../util/simulate_interaction';
import {extend} from '../../../../src/util/util';

function createMap(t, options) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map(extend({
        container: DOM.create('div', '', window.document.body),
    }, options));
}

test('New TouchZoomHandler is in "enabled" state', (t) => {
    const map = createMap(t);
    const h = new TouchZoomHandler(map);
    t.ok(h.isEnabled());
    t.equal(h._state, 'enabled');
    t.end();
});

test('TouchZoomHandler is added to manager by default', (t) => {
    const map = createMap(t);
    const hm = map.handlers;
    t.ok(hm.touchZoom);
    const h = hm.touchZoom;
    t.ok(h.isEnabled());
    t.end();
});

test('TouchZoomHandler responds to touchstart events', (t) => {
    const map = createMap(t, {zoom: 5});
    const h = map.handlers.touchZoom;

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    t.ok(h._startTouchEvent);
    t.equal(h._startTouchEvent.touches.length, 1);
    t.notOk(h._startTouchData.isMultiTouch);
    t.equal(h._state, 'enabled', 'single-touch event should not trigger "pending" state');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._startTouchEvent.touches.length, 2);
    t.ok(h._startTouchData.isMultiTouch);
    t.equal(h._startTouchData.vector.mag(), 5);
    t.equal(h._state, 'pending', 'single-touch event should trigger "pending" state');
    t.equal(h._startScale, 32); // z5
    t.end();
});

test('TouchZoomHandler scales map appropriately on touchmove events', (t) => {
    const map = createMap(t, {zoom: 5});
    const hm = map.handlers;
    const h = map.handlers.touchZoom;
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');

    t.stub(console, 'error').callsFake(console.log);
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event should not do anything');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 6, clientY: 8}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.zoom, 6, '.touchmove() should return target transform data');
    t.equal(map.transform.zoom, 6, 'manager should zoom in the map');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 1.5, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.zoom, 4, '.touchmove() should return target transform data');
    t.equal(map.transform.zoom, 4, 'manager should zoom out the map');
    t.end();
});

test('TouchRotateHandler rotates map appropriately on touchmove events', (t) => {
    const map = createMap(t, {bearing: 0});
    const hm = map.handlers;
    const h = map.handlers.touchRotate;
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');

    t.stub(console, 'error').callsFake(console.log);
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event should not do anything');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 0}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 3}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.bearing, -90, '.touchmove() should return target transform data');
    t.equal(map.transform.bearing, -90, 'manager should rotate the map clockwise');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 2, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.bearing, -45, '.touchmove() should return target transform data');
    t.equal(map.transform.bearing, -45, 'manager should rotate the map counterclockwise');
    t.end();
});

test('TouchZoomHandler and TouchRotateHandler can update the map simultaneously', (t) => {
    const map = createMap(t, {zoom: 5, bearing: 0});
    const hm = map.handlers;
    const rh = map.handlers.touchRotate;
    const zh = map.handlers.touchZoom;
    t.spy(rh, 'touchstart');
    t.spy(rh, 'touchmove');
    t.spy(zh, 'touchstart');
    t.spy(zh, 'touchmove');

    t.stub(console, 'error').callsFake(console.log);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 0}]});
    t.notOk(rh.touchmove.called, 'touchstart should not call touchmove method');
    t.notOk(zh.touchmove.called, 'touchstart should not call touchmove method');
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 6}]});
    console.log('rh.touchmove.returnValues', rh.touchmove.returnValues);
    console.log('zh.touchmove.returnValues', zh.touchmove.returnValues);

    t.equal(rh.touchmove.returnValues[0].transform.bearing, -90, '.touchmove() should return target transform data');
    t.equal(map.transform.bearing, -90, 'manager should rotate the map clockwise');
    t.equal(zh.touchmove.returnValues[0].transform.zoom, 6, '.touchmove() should return target transform data');
    t.equal(map.transform.zoom, 6, 'manager should zoom in the map');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 1, clientY: 1}]});
    console.log('rh.touchmove.returnValues', rh.touchmove.returnValues);
    console.log('zh.touchmove.returnValues', zh.touchmove.returnValues);
    t.equal(rh.touchmove.returnValues[1].transform.bearing, -45, '.touchmove() should return target transform data');
    t.equal(map.transform.bearing, -45, 'manager should rotate the map counterclockwise');
    t.equal(Math.round(zh.touchmove.returnValues[1].transform.zoom), 4, '.touchmove() should return target transform data');
    t.equal(Math.round(map.transform.zoom), 4, 'manager should zoom out the map');
    t.end();
});
