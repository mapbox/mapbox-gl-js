import {test} from '../../../util/test';
import { TouchHandler, TouchZoomHandler } from '../../../../src/ui/handler/touch';
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

test('New TouchZoomHandler listens for touchstart events', (t) => {
    const map = createMap(t, {zoom: 5});
    const h = new TouchZoomHandler(map);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    t.ok(h._startTouchEvent);
    t.equal(h._startTouchEvent.touches.length, 1);
    t.notOk(h._startTouchData.isMultiTouch);
    t.equal(h._state, 'enabled', 'single-touch event does not trigger "pending" state');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    t.equal(h._startTouchEvent.touches.length, 2);
    t.ok(h._startTouchData.isMultiTouch);
    t.equal(h._startTouchData.vector.mag(), 5);
    t.equal(h._state, 'pending', 'single-touch event triggers "pending" state');
    t.equal(h._startScale, 32); // z5
    t.end();
});

test('New TouchZoomHandler listens for touchmove events', (t) => {
    const map = createMap(t, {zoom: 5});
    const h = new TouchZoomHandler(map);

    t.stub(console, 'error').callsFake(console.log);
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 1, clientY: 1}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 1, clientY: 2}]});
    t.equal(h._state, 'enabled', 'single-touch event does not trigger anything');

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 3, clientY: 4}]});
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 6, clientY: 8}]});
    t.equal(h._state, 'active', 'multi-touch event activates the handler');
    t.equal(h._startScale, 32); // z5
    t.end();
});

// test('Methods .enable(), .disable(), and .isEnabled() work as expected', (t) => {
//     const map = createMap(t);
//     const h = new TouchHandler(map);
//     t.ok(h.isEnabled());
//     t.equal(h._state, 'enabled');
//     h.disable();
//     t.notOk(h.isEnabled());
//     t.equal(h._state, 'disabled');
//     h.enable();
//     t.ok(h.isEnabled());
//     t.end();
// });
//
// test('New TouchHandler is enabled by default', (t) => {
//     const map = createMap(t);
//     const h = new TouchHandler(map);
//     t.ok(h.isEnabled(), 'should be enabled');
//     t.end();
// });
//
// test('Methods .setOptions() and .getOptions() work as expected', (t) => {
//     const map = createMap(t);
//     const h = new TouchHandler(map);
//     t.deepEqual(h.getOptions(), {}, '.getOptions() should return options object');
//     t.throws(() => h.setOptions({ happy: true }), /happy/, '.setOptions() should throw error on unrecognized options');
//     h._options.happy = false;
//     t.doesNotThrow(() => h.setOptions({ happy: true }), '.setOptions() should not throw error on recognized options');
//     t.ok(h._options.happy, 'options should be set as ._options properties');
//     t.deepEqual(h.getOptions(), { happy: true }, '.getOptions() should return the up to date options');
//     t.end();
// });
