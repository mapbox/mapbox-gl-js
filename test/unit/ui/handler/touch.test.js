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

function setupEventSpies(eventTypes, map, t) {
  const spies = {};
  for (const eventType of eventTypes) {
    for (const eventStage of ['start', '', 'end']) {
      const event = eventType + eventStage;
      const spy = t.spy();
      spies[event] = spy;
      map.on(event, spy);
    }
  }
  return spies;
};

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

    const spies = setupEventSpies(['drag', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    t.equal(h._state, 'pending', 'single-touch touchstart event should trigger "pending" state');
    t.ok(h._startTouchEvent);
    t.equal(h._startTouchEvent.touches.length, 1);
    t.notOk(h._startTouchData.isMultiTouch);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchstart');

    simulate.touchend(map.getCanvas(), {changedTouches: [{clientX: 1, clientY: 1}]});
    t.equal(h._state, 'enabled', 'touchend should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchend if handler was never active');


    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._startTouchEvent.touches.length, 2);
    t.ok(h._startTouchData.isMultiTouch);
    t.equal(h._state, 'pending', 'multi-touch touchstart event should trigger "pending" state');
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchstart');

    simulate.touchend(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}], changedTouches: [{clientX: 3, clientY: 4}]});
    t.equal(h._state, 'pending', 'touchend should not deactivate handler if any fingers are still touching');
    t.equal(h._startTouchEvent.touches.length, 1);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchend if handler was never active');


    simulate.touchcancel(map.getCanvas(), {changedTouches: [{clientX: 0, clientY: 0}]});
    t.equal(h._state, 'enabled', 'touchcancel should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchcancel if handler was never active');
    t.end();
});

test('TouchPanHandler pans map & fires events appropriately on single-finger drag', (t) => {
    const map = createMap(t, {zoom: 1, center: [0,0]});
    const hm = map.handlers;
    hm.disableAll();
    const h = map.handlers.touchPan;
    h.enable();
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');

    const spies = setupEventSpies(['drag', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    for (const startEvent of ['dragstart', 'movestart']) t.equal(spies[startEvent].callCount, 0, `${startEvent} should not be fired until first movement`);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 1.5}]});
    t.equal(h._state, 'pending', 'moving less than tapTolerance should not activate the handler');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');
    t.ok(map.getCenter().lng === 0 && map.getCenter().lat === 0, 'manager should not pan the map');
    for (const event in spies) t.equal(spies[event].callCount, 0, `${event} should not be fired if handler was not activated`);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}]});
    t.equal(h._state, 'active', 'moving more than clickTolerance should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.setLocationAtPoint.length, 2, '.touchmove() should return new location for transform');
    t.deepEqual(h.touchmove.returnValues[1].events, ['dragstart', 'drag'], '.touchmove() should return start and move events to fire');
    t.notEqual(map.getCenter().lng, 0, 'manager should change the map center lng');
    t.notEqual(map.getCenter().lat, 0, 'manager should change the map center lat');

    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should be fired on first movement`);
      else t.equal(spies[event].callCount, 1, `${event} should be fired on every movement`);
    }

    simulate.touchend(map.getCanvas());
    for (const endEvent of ['dragend', 'moveend']) t.equal(spies[endEvent].callCount, 1, `${endEvent} should be fired on touchend if handler was active`);

    t.end();
});

test('TouchPanHandler fires events appropriately when touch is canceled', (t) => {
    const map = createMap(t, {zoom: 1, center: [0,0]});
    const hm = map.handlers;
    hm.disableAll();
    hm.touchPan.enable();

    const spies = setupEventSpies(['dragend', 'moveend'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}]});
    simulate.touchcancel(map.getCanvas());
    for (const endEvent of ['dragend', 'moveend']) t.equal(spies[endEvent].callCount, 1, `${endEvent} should be fired on touchcancel if handler was active`);

    t.end();
});

test('TouchPanHandler pans map & fires events appropriately when transitioning between single & multi-finger drag', (t) => {
    const map = createMap(t, {zoom: 1, center: [0,0]});
    const hm = map.handlers;
    hm.disableAll();
    const h = map.handlers.touchPan;
    h.enable();
    t.spy(h, 'touchmove');
    t.spy(map, 'easeTo');

    const spies = setupEventSpies(['drag', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}]});
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}, {clientX: 1, clientY: 2}]});
    t.equal(h._state, 'active', 'adding a finger should leave the handler active');
    for (const startEvent of ['dragstart', 'movestart']) t.equal(spies[startEvent].callCount, 1, `${startEvent} should not be fired more than once`);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}, {clientX: 5, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-finger move should leave the handler active');
    t.ok(h.touchmove.returnValues[1].transform.setLocationAtPoint.length, 2, '.touchmove() should return new location for transform');
    t.deepEqual(h.touchmove.returnValues[1].events, ['drag'], '.touchmove() should return drag event to fire');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0, `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should not be fired more than once`);
      else t.equal(spies[event].callCount, 2, `${event} should be fired on every movement`);
    }

    simulate.touchend(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}], changedTouches: [{clientX: 5, clientY: 2}]});
    for (const endEvent of ['dragend', 'moveend']) t.equal(spies[endEvent].callCount, 0, `${endEvent} should not be fired on touchend if any touches remain`);
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}]});
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0, `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should not be fired more than once`);
      else t.equal(spies[event].callCount, 3, `${event} should be fired on every movement`);
    }

    simulate.touchend(map.getCanvas());
    t.equal(spies['dragend'].callCount, 1, `dragend should be fired on touchend if no touches remain`);
    t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');

    t.end();
});

test('TouchPanHandler does not cause map to jump when removing first touch point', (t) => {
  // Bug https://github.com/mapbox/mapbox-gl-js/issues/9136
  const map = createMap(t, {center: [0,0]});
  const hm = map.handlers;
  const h = map.handlers.touchPan;

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}, {clientX: 3, clientY: 4}]});
  let oldCenter = map.getCenter();
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 5, clientY: 2}, {clientX: 8, clientY: 4}]});
  t.equal(h._state, 'active', 'multi-touch event should activate the handler');
  t.ok(map.getCenter().lng !== oldCenter.lng && map.getCenter().lat !== oldCenter.lat, 'manager should pan the map');

  oldCenter = map.getCenter();
  simulate.touchend(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}], changedTouches: [{clientX: 5, clientY: 2}]});
  t.equal(h._state, 'active', 'multi-touch touchend should not deactivate the handler if there are touches remaining');
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 8, clientY: 4}]});
  t.ok(map.getCenter().lng === oldCenter.lng && map.getCenter().lat === oldCenter.lat, 'manager should not pan the map if remaining touch has not moved');

  t.end();
})


test('TouchZoomHandler responds to touchstart/end/cancel events', (t) => {
    const map = createMap(t, {zoom: 5});
    const h = map.handlers.touchZoom;
    const spies = setupEventSpies(['zoom', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    t.equal(h._state, 'enabled', 'single-touch event should not trigger "pending" state');
    t.notOk(h._startTouchEvent);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired if handler does not activate');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._state, 'pending', 'multi-touch event should trigger "pending" state');
    t.equal(h._startTouchEvent.touches.length, 2);
    t.ok(h._startTouchData.isMultiTouch);
    t.equal(h._startTouchData.vector.mag(), 5);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchstart');

    simulate.touchend(map.getCanvas(), {changedTouches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._state, 'enabled', 'touchend should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchend if handler was never active');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    simulate.touchcancel(map.getCanvas(), {changedTouches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._state, 'enabled', 'touchcancel should reset handler to "enabled" state');
    t.notOk(h._startTouchEvent);
    for (const event in spies) t.equal(spies[event].callCount, 0, 'no events should be fired on touchcancel if handler was never active');

    t.end();
});

test('TouchZoomHandler scales map appropriately on touchmove events', (t) => {
    const map = createMap(t, {zoom: 5});
    const hm = map.handlers;
    hm.disableAll(); // The dummy touches below are so close together, they activate touchPitch handler
    const h = map.handlers.touchZoom;
    h.enable();
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');
    t.spy(map, 'easeTo');

    const spies = setupEventSpies(['zoom', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    for (const startEvent of ['zoomstart', 'movestart']) t.equal(spies[startEvent].callCount, 0, `${startEvent} should not be fired until first movement`);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event should not do anything');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');
    for (const event in spies) t.equal(spies[event].callCount, 0, `${event} should not be fired if handler was not activated`);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    for (const startEvent of ['zoomstart', 'movestart']) t.equal(spies[startEvent].callCount, 0, `${startEvent} should not be fired until first movement`);
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 6, clientY: 8}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.zoomDelta, 1, '.touchmove() should return delta to apply to transform');
    t.deepEqual(h.touchmove.returnValues[1].events, ['zoomstart', 'zoom'], '.touchmove() should return start and move events to fire');
    t.equal(map.getZoom(), 6, 'manager should zoom in the map');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should be fired on first movement`);
      else t.equal(spies[event].callCount, 1, `${event} should be fired on every movement`);
    }

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 1.5, clientY: 2}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.zoomDelta, -2, '.touchmove() should return delta to apply to transform');
    t.equal(map.getZoom(), 4, 'manager should zoom out the map');
    for (const event of ['zoom', 'move']) t.equal(spies[event].callCount, 2, `${event} should be fired on every movement`);

    const oldZoom = map.getZoom();
    simulate.touchend(map.getCanvas());
    t.equal(spies['zoomend'].callCount, 1, `zoomend should be fired on touchend if handler was active`);
    t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
    t.ok(map.easeTo.getCall(0).args[0].zoom < oldZoom, 'easeTo should be called with smaller zoom for inertial zoom out');

    t.end();
});

test('TouchRotateHandler rotates map appropriately on touchmove events', (t) => {
    const map = createMap(t, {bearing: 0});
    const hm = map.handlers;
    hm.disableAll();
    const h = map.handlers.touchRotate;
    h.enable();
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');
    t.spy(map, 'easeTo');

    const spies = setupEventSpies(['rotate', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    for (const startEvent of ['rotatestart', 'movestart']) t.equal(spies[startEvent].callCount, 0, `${startEvent} should not be fired until first movement`);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event should not do anything');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');
    for (const event in spies) t.equal(spies[event].callCount, 0, `${event} should not be fired if handler was not activated`);


    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 0}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 3}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.bearingDelta, -90, '.touchmove() should return delta to apply to transform');
    t.deepEqual(h.touchmove.returnValues[1].events, ['rotatestart', 'rotate'], '.touchmove() should return start and move events to fire');
    t.equal(map.getBearing(), -90, 'manager should rotate the map clockwise');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should be fired on first movement`);
      else t.equal(spies[event].callCount, 1, `${event} should be fired on every movement`);
    }

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 80, clientY: 80}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.bearingDelta, 45, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -45, 'manager should rotate the map counterclockwise');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should not be fired more than once`);
      else t.equal(spies[event].callCount, 2, `${event} should be fired on every movement`);
    }

    simulate.touchend(map.getCanvas());
    t.equal(spies['rotateend'].callCount, 1, `rotateend should be fired on touchend if handler was active`);
    t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
    t.ok(map.easeTo.getCall(0).args[0].bearing < -45, 'easeTo should be called with counterclockwise bearing for inertial rotate');

    t.end();
});

test('TouchPitchHandler pitches map appropriately on touchmove events', (t) => {
    const map = createMap(t, {pitch: 0});
    const hm = map.handlers;
    hm.disableAll();
    const h = map.handlers.touchPitch;
    h.enable();
    t.spy(h, 'touchstart');
    t.spy(h, 'touchmove');
    t.spy(map, 'easeTo');

    const spies = setupEventSpies(['pitch', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event should not do anything');
    t.ok(h.touchmove.called && !h.touchmove.returnValues[0], '.touchmove() should be called but return nothing');
    for (const event in spies) t.equal(spies[event].callCount, 0, `${event} should not be fired if handler was not activated`);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 20}, {clientX: 11, clientY: 20}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 0}, {clientX: 11, clientY: 0}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[1].transform.pitchDelta, 8, '.touchmove() should return delta to apply to transform');
    t.deepEqual(h.touchmove.returnValues[1].events, ['pitchstart', 'pitch'], '.touchmove() should return start and move events to fire');
    t.equal(map.getPitch(), 8, 'manager should pitch the map more');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should be fired on first movement`);
      else t.equal(spies[event].callCount, 1, `${event} should be fired on every movement`);
    }

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 10}, {clientX: 11, clientY: 10}]});
    t.equal(h._state, 'active', 'multi-touch event should activate the handler');
    t.equal(h.touchmove.returnValues[2].transform.pitchDelta, -4, '.touchmove() should return delta to apply to transform');
    t.equal(map.getPitch(), 4, 'manager should pitch the map less');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should not be fired more than once`);
      else t.equal(spies[event].callCount, 2, `${event} should be fired on every movement`);
    }

    simulate.touchend(map.getCanvas());
    t.equal(spies['pitchend'].callCount, 1, `pitchend should be fired on touchend if handler was active`);
    t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
    t.end();
});


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
    t.spy(map, 'easeTo');

    const spies = setupEventSpies(['rotate', 'zoom', 'move'], map, t);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 300, clientY: 0}]});
    t.notOk(rh.touchmove.called, 'touchstart should not call touchmove method');
    t.notOk(zh.touchmove.called, 'touchstart should not call touchmove method');
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 600}]});

    t.equal(rh.touchmove.returnValues[0].transform.bearingDelta, -90, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -90, 'manager should rotate the map clockwise');
    t.equal(zh.touchmove.returnValues[0].transform.zoomDelta, 1, '.touchmove() should return delta to apply to transform');
    t.equal(map.getZoom(), 6, 'manager should zoom in the map');
    t.deepEqual(rh.touchmove.returnValues[0].events, ['rotatestart', 'rotate'], '.touchmove() should return start and move events to fire');
    t.deepEqual(zh.touchmove.returnValues[0].events, ['zoomstart', 'zoom'], '.touchmove() should return start and move events to fire');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should be fired on first movement`);
      else t.equal(spies[event].callCount, 1, `${event} should be fired on every movement`);
    }

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 100, clientY: 100}]});
    t.equal(rh.touchmove.returnValues[1].transform.bearingDelta, 45, '.touchmove() should return delta to apply to transform');
    t.equal(map.getBearing(), -45, 'manager should rotate the map counterclockwise');
    t.equal(Math.round(zh.touchmove.returnValues[1].transform.zoomDelta), -2, '.touchmove() should return delta to apply to transform');
    t.equal(Math.round(map.getZoom()), 4, 'manager should zoom out the map');
    for (const event in spies) {
      if (event.endsWith('end')) t.equal(spies[event].callCount, 0,  `${event} should not be fired until movement has stopped`);
      else if (event.endsWith('start')) t.equal(spies[event].callCount, 1, `${event} should not be fired more than once`);
      else t.equal(spies[event].callCount, 2, `${event} should be fired on every movement`);
    }

    simulate.touchend(map.getCanvas());
    for (const endEvent of ['rotateend', 'zoomend']) t.equal(spies[endEvent].callCount, 1, `${endEvent} should be fired on touchend if handler was active`);
    t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handlers were active with inertia');
    t.ok(map.easeTo.getCall(0).args[0].bearing < -45, 'easeTo should be called with counterclockwise bearing for inertial rotate');
    t.ok(map.easeTo.getCall(0).args[0].zoom < 4, 'easeTo should be called with smaller zoom for inertial zoom out');

    t.end();
});
