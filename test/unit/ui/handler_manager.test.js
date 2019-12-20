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
    t.equal(hm.length, 3, '.length should be accurate'); //TODO will change
    t.ok(hm.touchZoom, 'default handlers should be available through named properties');
    t.deepEqual(hm.list(), ['touchPitch', 'touchZoom', 'touchRotate'], '.list() method should return an array of handler names'); //TODO will change
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

  for (const mouseType of ['down', 'up']) {
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
