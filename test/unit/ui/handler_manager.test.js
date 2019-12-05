import {test} from '../../util/test';
import {extend} from '../../../src/util/util';
import window from '../../../src/util/window';
import Map from '../../../src/ui/map';
import HandlerManager from '../../../src/ui/handler_manager';
import Handler from '../../../src/ui/handler';
import DOM from '../../../src/util/dom';
// import simulate from '../../../util/simulate_interaction';
// import browser from '../../../../src/util/browser';

function createMap(t, options) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map(extend({container: DOM.create('div', '', window.document.body)}, options));
}

// test('HandlerManager accepts global interaction options', (t) => {
//     const map = createMap(t);
//
// });

test('HandlerManager is an iterable collection of handlers', (t) => {
    const map = createMap(t);
    const hm = new HandlerManager(map, {});
    t.doesNotThrow(() => { for (let h of hm) h }, 'can be used in a for..of loop');
    t.doesNotThrow(() => [...hm], 'can be used with spread operator');
    t.equal(typeof hm.length, 'number', 'should have a numeric .length property');
    const myHandler = new Handler();
    hm.add('myHandler', myHandler);
    t.equal(hm.length, 1, '.length should be accurate'); //TODO will change
    t.deepEqual(hm.list(), ['myHandler'], '.list() method should return an array of handler names'); //TODO will change
    t.deepEqual([...hm], [myHandler], 'iterator should yield Handler objects'); //TODO will change
    t.end();
});

test('Handler array can be updated with .add() and .remove() methods', (t) => {
  const map = createMap(t);
  const hm = new HandlerManager(map, {});

  t.throws(() => hm.add(handy), '.add() throws error if no name provided');
  t.throws(() => hm.add('handy'), '.add() throws error if no handler provided');
  t.throws(() => hm.add('notgonnawork', new Date()), '.add() throws error if handler is not an instance of Handler');
  const handy = new Handler();
  t.throws(() => hm.add('not a good Handler-Name', handy), '.add() throws error if handlerName is improperly formatted');
  hm.add('handy', handy);
  t.equal(hm.length, 1, '.add() should append the handler to the collection');
  t.equal(hm.handy, handy, '.add() should make the new handler available as a property with the given name');
  t.throws(() => hm.add('handy', handy), '.add() throws error if handler already exists');
  t.throws(() => hm.add('handier', handy), '.add() throws error if handler already exists with a different name');
  const handier = new Handler();
  t.throws(() => hm.add('handy', handier), '.add() throws error if there is already a handler with this name');
  hm.add('handier', handier);
  t.ok(hm.length === 2 && hm._handlers[1][1] === handier, '.add() should append the handler to the collection');


  t.throws(() => hm.remove(), '.remove() throws error if no handlerName is provided');
  t.throws(() => hm.remove(handy), '.remove() throws error if handlerName is not a String');
  t.throws(() => hm.remove('notathing'), '.remove() throws error if handler name does not exist');
  hm.remove('handy');
  t.ok(hm.length === 1 && hm._handlers[0][1] === handier, '.remove() should remove the handler from the collection');

  t.end();
});
