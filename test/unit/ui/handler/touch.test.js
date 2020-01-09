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

test('TouchPanHandler is added to manager by default', (t) => {
    const map = createMap(t);
    const hm = map.handlers;
    t.ok(hm.touchPan);
    const h = hm.touchPan;
    t.ok(h.isEnabled());
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

test('TouchRotateHandler is added to manager by default', (t) => {
    const map = createMap(t);
    const hm = map.handlers;
    t.ok(hm.touchRotate);
    const h = hm.touchRotate;
    t.ok(h.isEnabled());
    t.end();
});

test('TouchPitchHandler is added to manager by default', (t) => {
    const map = createMap(t);
    const hm = map.handlers;
    t.ok(hm.touchPitch);
    const h = hm.touchPitch;
    t.ok(h.isEnabled());
    t.end();
});

test('TouchPanHandler responds to touchstart/end/cancel events', (t) => {
    const map = createMap(t, {zoom: 5});
    const h = map.handlers.touchPan;

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    t.equal(h._state, 'pending', 'single-touch touchstart event should trigger "pending" state');
    t.ok(h._startTouchEvent);
    t.equal(h._startTouchEvent.touches.length, 1);
    t.notOk(h._startTouchData.isMultiTouch);

    simulate.touchend(map.getCanvas(), {changedTouches: [{clientX: 1, clientY: 1}]});
    t.equal(h._state, 'enabled', 'touchend should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._startTouchEvent.touches.length, 2);
    t.ok(h._startTouchData.isMultiTouch);
    t.equal(h._state, 'pending', 'multi-touch touchstart event should trigger "pending" state');

    simulate.touchend(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}], changedTouches: [{clientX: 3, clientY: 4}]});
    t.equal(h._state, 'pending', 'touchend should not deactivate handler if any fingers are still touching');
    t.equal(h._startTouchEvent.touches.length, 1);

    simulate.touchcancel(map.getCanvas(), {changedTouches: [{clientX: 0, clientY: 0}]});
    t.equal(h._state, 'enabled', 'touchcancel should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);
    t.end();
});

test('TouchPanHandler pans map appropriately on touchmove events', (t) => {
    const map = createMap(t, {zoom: 1, center: [0,0]});
    const hm = map.handlers;
    const h = map.handlers.touchPan;
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 1.5}]});
    t.equal(h._state, 'pending', 'moving less than clickTolerance should not activate the handler');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');
    t.ok(map.getCenter().lng === 0 && map.getCenter().lat === 0, 'manager should not pan the map');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}]});
    t.equal(h._state, 'active', 'moving more than clickTolerance should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.setLocationAtPoint.length, 2, '.touchmove() should return new location for transform');
    t.ok(map.getCenter().lng === -0.7031250000023874 && map.getCenter().lat === 1.0546279422783584, 'manager should pan the map');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}, {clientX: 1, clientY: 2}]});
    t.equal(h._state, 'active', 'adding a finger should leave the handler active');
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}, {clientX: 5, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-finger move should leave the handler active');
    t.ok(h.touchmove.returnValues[1].transform.setLocationAtPoint.length, 2, '.touchmove() should return new location for transform');
    t.ok(map.getCenter().lng === -24.3524639423116 && map.getCenter().lat === 2.514216764823942, 'manager should pan the map');

    t.end();
});

test('TouchPanHandler does not cause map to jump when removing first touch point', (t) => {
  // Bug https://github.com/mapbox/mapbox-gl-js/issues/9136
  const map = createMap(t, {center: [0,0]});
  const hm = map.handlers;
  const h = map.handlers.touchPan;

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}, {clientX: 3, clientY: 4}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 5, clientY: 2}, {clientX: 8, clientY: 4}]});
  t.equal(h._state, 'active', 'multi-touch event should activate the handler');
  const oldCenter = map.getCenter();
  t.ok(map.getCenter().lng === -47.298677884617064 && map.getCenter().lat === 2.91940900926312, 'manager should pan the map');

  simulate.touchend(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}], changedTouches: [{clientX: 5, clientY: 2}]});
  t.equal(h._state, 'active', 'multi-touch touchend should not deactivate the handler if there are touches remaining');
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}]});
  t.ok(map.getCenter().lng === oldCenter.lng && map.getCenter().lat === oldCenter.lat, 'manager should not pan the map if remaining touch has not moved');

  t.end();
})


test('TouchZoomHandler responds to touchstart/end/cancel events', (t) => {
    const map = createMap(t, {zoom: 5});
    const h = map.handlers.touchZoom;

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    t.equal(h._state, 'enabled', 'single-touch event should not trigger "pending" state');
    t.notOk(h._startTouchEvent);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._state, 'pending', 'multi-touch event should trigger "pending" state');
    t.equal(h._startTouchEvent.touches.length, 2);
    t.ok(h._startTouchData.isMultiTouch);
    t.equal(h._startTouchData.vector.mag(), 5);

    simulate.touchend(map.getCanvas(), {changedTouches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._state, 'enabled', 'touchend should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    simulate.touchcancel(map.getCanvas(), {changedTouches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._state, 'enabled', 'touchcancel should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);
    t.end();
});

test('TouchZoomHandler scales map appropriately on touchmove events', (t) => {
    const map = createMap(t, {zoom: 5});
    const hm = map.handlers;
    map.handlers.touchPitch.disable(); // The dummy touches below are so close together, they activate touchPitch handler
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
    t.equal(h.touchmove.returnValues[1].transform.zoomDelta, 1, '.touchmove() should return delta to apply to transform');
    t.equal(map.getZoom(), 6, 'manager should zoom in the map');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 1.5, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.zoomDelta, -2, '.touchmove() should return delta to apply to transform');
    t.equal(map.getZoom(), 4, 'manager should zoom out the map');
    t.end();
});

test('TouchRotateHandler rotates map appropriately on touchmove events', (t) => {
    const map = createMap(t, {bearing: 0});
    const hm = map.handlers;
    map.handlers.touchPitch.disable();
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
    t.equal(h.touchmove.returnValues[1].transform.bearingDelta, -90, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -90, 'manager should rotate the map clockwise');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 2, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.bearingDelta, 45, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -45, 'manager should rotate the map counterclockwise');
    t.end();
});

test('TouchPitchHandler pitches map appropriately on touchmove events', (t) => {
    const map = createMap(t, {pitch: 0});
    const hm = map.handlers;
    const h = map.handlers.touchPitch;
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');

    t.stub(console, 'error').callsFake(console.log);
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event should not do anything');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 20}, {clientX: 11, clientY: 20}]});
    // console.log('after touchstart', h._state, h._startTouchData, h._lastTouchData);
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 0}, {clientX: 11, clientY: 0}]});
    // console.log('after touchmove', h._state, h._startTouchData, h._lastTouchData);
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.pitchDelta, 10, '.touchmove() should return delta to apply to transform');
    t.equal(map.getPitch(), 10, 'manager should pitch the map more');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 10}, {clientX: 11, clientY: 10}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.pitchDelta, -5, '.touchmove() should return delta to apply to transform');
    t.equal(map.getPitch(), 5, 'manager should pitch the map less');
    t.end();
});

//TODO test for map zoom/pitch/rotate events

test('TouchZoomHandler and TouchRotateHandler can update the map simultaneously', (t) => {
    const map = createMap(t, {zoom: 5, bearing: 0});
    const hm = map.handlers;
    hm.touchPitch.disable();
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

    t.equal(rh.touchmove.returnValues[0].transform.bearingDelta, -90, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -90, 'manager should rotate the map clockwise');
    t.equal(zh.touchmove.returnValues[0].transform.zoomDelta, 1, '.touchmove() should return delta to apply to transform');
    t.equal(map.getZoom(), 6, 'manager should zoom in the map');

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 1, clientY: 1}]});
    t.equal(rh.touchmove.returnValues[1].transform.bearingDelta, 45, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -45, 'manager should rotate the map counterclockwise');
    t.equal(Math.round(zh.touchmove.returnValues[1].transform.zoomDelta), -2, '.touchmove() should return delta to apply to transform');
    t.equal(Math.round(map.getZoom()), 4, 'manager should zoom out the map');
    t.end();
});
