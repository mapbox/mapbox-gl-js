import {test} from '../../util/test';
import {extend} from '../../../src/util/util';
import Map from '../../../src/ui/map';
import HandlerManager from '../../../src/ui/handler_manager';
import Handler from '../../../src/ui/handler/handler';
import {createMap} from '../../util';
import simulate, {window} from '../../util/simulate_interaction';


test('HandlerManager contains default handlers', (t) => {
    const map = createMap(t);
    const hm = map.handlers;
    t.equal(typeof hm.length, 'number', 'should have a numeric .length property');
    t.equal(hm.length, 4, '.length should be accurate'); //TODO will change
    t.ok(hm.touchZoom, 'default handlers should be available through named properties');
    t.deepEqual(hm.list(), ['touchRotate', 'touchPitch', 'touchZoom', 'touchPan'], '.list() method should return an array of handler names'); //TODO will change
    t.end();
});

test('Handler array can be updated with .add(), .remove(), and .removeAll() methods', (t) => {
  const map = createMap(t);
  const hm = map.handlers;

  hm.removeAll();
  t.equal(hm.length, 0, 'after .removeAll() length should be zero');
  t.deepEqual(hm._handlers, [], 'after .removeAll() the collection should be empty');
  t.notOk(hm.touchZoom || hm.touchRotate, '.removeAll() should delete named handler properties');

  t.throws(() => hm.add(handy), '.add() throws error if no name provided');
  t.throws(() => hm.add('handy'), '.add() throws error if no handler provided');
  t.throws(() => hm.add('notgonnawork', new Date()), '.add() throws error if handler is not an instance of Handler');
  const handy = new Handler(map);
  t.throws(() => hm.add('not a good Handler-Name', handy), '.add() throws error if handlerName is improperly formatted');
  hm.add('handy', handy);
  t.ok(hm.length === 1, '.add() should increase .length');
  t.ok(hm._handlers[0][1] === handy, '.add() should append the handler to the collection');
  t.equal(hm.handy, handy, '.add() should make the new handler available as a property with the given name');

  t.throws(() => hm.add('handy', handy), '.add() throws error if handler already exists');
  t.throws(() => hm.add('handier', handy), '.add() throws error if handler already exists with a different name');
  const handier = new Handler(map);
  t.throws(() => hm.add('handy', handier), '.add() throws error if there is already a handler with this name');
  hm.add('handier', handier);
  t.ok(hm.length === 2, '.add() should increase .length');
  t.ok(hm._handlers[1][1] === handier, '.add() should append the handler to the collection');

  t.throws(() => hm.remove(), '.remove() throws error if no handlerName is provided');
  t.throws(() => hm.remove(handy), '.remove() throws error if handlerName is not a String');
  t.throws(() => hm.remove('notathing'), '.remove() throws error if handler name does not exist');
  hm.remove('handy');
  t.ok(hm.length === 1, '.remove() should decrease .length');
  t.ok(hm._handlers[0][1] === handier, '.remove() should remove the handler from the collection');
  t.notOk(hm.handy, '.remove() should delete the named handler property');

  t.end();
});

test('Handlers can be en/disabled with en/disableAll() methods', (t) => {
    const map = createMap(t);
    const hm = map.handlers;
    const handlerNames = hm.list();

    hm.disableAll();
    handlerNames.map((h) => t.notOk(hm[h].isEnabled(), 'disableAll() should disable each handler'));

    hm.enableAll();
    handlerNames.map((h) => t.ok(hm[h].isEnabled(), 'enableAll() should disable each handler'));

    t.end();
});

test('Constructor sets up event listeners to fire map events and call handler event processors', (t) => {
  const map = createMap(t);
  const hm = map.handlers;
  const handy = new Handler(map);
  handy.mousedown = (e) => {
    t.equal(e.type, 'mousedown');
  };
  t.spy(handy, 'mousedown');
  hm.add('handy', handy);

  const tzh = hm.touchZoom;

  for (const touchType of ['start', 'move', 'end', 'cancel']) {
    const eventType = 'touch' + touchType;

    t.spy(tzh, 'processInputEvent');
    const spy = t.spy(function (e) {
      t.equal(this, map);
      t.equal(e.type, eventType);
    });
    map.on(eventType, spy);

    simulate[eventType](map.getCanvasContainer());
    t.ok(spy.called);
    t.equal(spy.callCount, 1);
    t.ok(tzh.processInputEvent.called);
    t.equal(tzh.processInputEvent.args[0][0].type, eventType);
    tzh.processInputEvent.restore();
  }

  for (const mouseType of ['down', 'up', 'move', 'over', 'out']) {
    const eventType = 'mouse' + mouseType;

    t.spy(tzh, 'processInputEvent');
    const spy = t.spy(function (e) {
      t.equal(this, map);
      t.equal(e.type, eventType);
    });
    map.on(eventType, spy);

    simulate[eventType](map.getCanvasContainer());
    t.ok(spy.called);
    t.equal(spy.callCount, 1);
    t.ok(tzh.processInputEvent.called)
    t.equal(tzh.processInputEvent.args[0][0].type, eventType);
    if (eventType === 'mousedown') {
      t.ok(handy.mousedown.called);
    }
    tzh.processInputEvent.restore();
  }

  t.end();
});

test('HandlerManager applies transforms requested by handler event processors', (t) => {
  const map = createMap(t, { zoom: 5 });
  const hm = map.handlers;
  hm.removeAll();

  const handy = new Handler(map);
  handy.mousedown = (e) => {
    t.equal(e.type, 'mousedown');
    return { transform: { zoomDelta: 5 }};
  };
  t.spy(handy, 'mousedown');
  hm.add('handy', handy);

  simulate.mousedown(map.getCanvasContainer());
  t.equal(map.getZoom(), 10);

  t.end();
});

test('HandlerManager fires map movement events as requested by handlers', (t) => {
  const map = createMap(t);
  const hm = map.handlers;
  hm.removeAll();

  const handy = new Handler(map);
  handy.mousedown = (e) => { handy._state = 'pending'; };
  handy.mousemove = (e) => {
    handy._state = 'active';
    return { events: ['zoomstart', 'pitchstart', 'rotatestart', 'dragstart', 'zoom', 'pitch', 'rotate', 'drag'] };
  };
  handy.mouseup = (e) => {
    handy._state = 'enabled';
    return { events: ['zoomend', 'pitchend', 'rotateend', 'dragend'] };
  };
  hm.add('handy', handy);

  const spies = {};
  for (const eventType of ['move', 'zoom', 'pitch', 'rotate', 'drag']) {
    for (const eventStage of ['start', '', 'end']) {
      const event = eventType + eventStage;
      const spy = t.spy();
      spies[event] = spy;
      map.on(event, spy);
    }
  };

  simulate.mousedown(map.getCanvasContainer());
  for (const event in spies) {
    t.equal(spies[event].callCount, 0, `${event} should not be fired until the map is updated`);
  }
  simulate.mousemove(map.getCanvasContainer(), {clientX: 10, clientY: 10});
  for (const event in spies) {
    if (event.endsWith('end')) {
      t.equal(spies[event].callCount, 0, `${event} should not be fired until movement stops`);
    } else if (event.endsWith('start')) {
      t.equal(spies[event].callCount, 1, `${event} should be fired on first movement`);
    } else {
      t.equal(spies[event].callCount, 1, `${event} should be fired on each movement`);
    }
  }
  simulate.mouseup(map.getCanvasContainer());
  for (const event in spies) {
    if (event.endsWith('end')) {
      t.equal(spies[event].callCount, 1, `${event} should be fired when movement stops`);
    } else if (event.endsWith('start')) {
      t.equal(spies[event].callCount, 1, `${event} should not be fired more than once`);
    } else {
      t.equal(spies[event].callCount, 1, `${event} should be fired only on movement`);
    }
  }

  t.end();
});

test('HandlerManager performs inertial pan', (t) => {
  const map = createMap(t, {zoom: 1, center: [0,0]});
  map.handlers.disableAll();
  map.handlers.touchPan.enable();
  t.spy(map, 'easeTo');

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 3, clientY: 4}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 9, clientY: 10}]});
  simulate.touchend(map.getCanvas());

  t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
  const easeToArgs = map.easeTo.getCall(0).args[0];
  t.ok(easeToArgs.offset && (easeToArgs.offset[0] + easeToArgs.offset[1] !== 0), 'easeTo should be called with a nonzero offset');
  t.deepEqual(easeToArgs.center, map.getCenter(), 'easeTo should be called with the map center as center option');
  t.notOk(easeToArgs.around, 'easeTo should not be called with an around option');
  t.end();
});

test('HandlerManager performs inertial zoom', (t) => {
  const map = createMap(t, {zoom: 1, center: [0,0]});
  map.handlers.disableAll();
  map.handlers.touchZoom.enable();
  t.spy(map, 'easeTo');

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 6, clientY: 8}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 1.5, clientY: 2}]});
  const oldZoom = map.getZoom();
  simulate.touchend(map.getCanvas());

  t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
  t.ok(map.easeTo.getCall(0).args[0].zoom < oldZoom, 'easeTo should be called with smaller zoom for inertial zoom out');
  t.ok(map.easeTo.getCall(0).args[0].around, 'easeTo should be called with an around option');
  t.end();
});

test('HandlerManager performs inertial rotate', (t) => {
  const map = createMap(t, {zoom: 1, center: [0,0]});
  map.handlers.disableAll();
  map.handlers.touchRotate.enable();
  t.spy(map, 'easeTo');

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 0}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 3}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 80, clientY: 80}]});
  simulate.touchend(map.getCanvas());

  t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
  t.ok(map.easeTo.getCall(0).args[0].bearing < -45, 'easeTo should be called with counterclockwise bearing for inertial rotate');
  t.ok(map.easeTo.getCall(0).args[0].around, 'easeTo should be called with an around option');
  t.end();
});

test('HandlerManager performs inertial pitch', (t) => {
  const map = createMap(t, {zoom: 1, center: [0,0]});
  map.handlers.disableAll();
  map.handlers.touchPitch.enable();
  t.spy(map, 'easeTo');

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 20}, {clientX: 11, clientY: 20}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 0}, {clientX: 11, clientY: 0}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 10}, {clientX: 11, clientY: 10}]});
  simulate.touchend(map.getCanvas());

  t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handler was active with inertia');
  t.notEqual(map.easeTo.getCall(0).args[0].pitch, 4, 'easeTo should be called with new pitch for inertial pitch');
  t.end();
});

test('HandlerManager performs multiple inertial movements simultaneously', (t) => {
  const map = createMap(t, {zoom: 1, center: [0,0]});
  t.spy(map, 'easeTo');

  simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 300, clientY: 0}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 0, clientY: 600}]});
  simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 100, clientY: 100}]});
  simulate.touchend(map.getCanvas());

  t.equal(map.easeTo.callCount, 1, 'easeTo should be fired on touchend if handlers were active with inertia');
  t.ok(map.easeTo.getCall(0).args[0].bearing < -45, 'easeTo should be called with counterclockwise bearing for inertial rotate');
  t.ok(map.easeTo.getCall(0).args[0].zoom < 4, 'easeTo should be called with smaller zoom for inertial zoom out');
  t.end();
});
