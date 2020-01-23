import {test} from '../../../util/test';
import Handler from '../../../../src/ui/handler/handler';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';


function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({
        container: DOM.create('div', '', window.document.body),
    });
}


test('Methods .enable(), .disable(), and .isEnabled() work as expected', (t) => {
    const map = createMap(t);
    const h = new Handler(map);
    t.ok(h.isEnabled());
    t.equal(h._state, 'enabled');
    h.disable();
    t.notOk(h.isEnabled());
    t.equal(h._state, 'disabled');
    h.enable();
    t.ok(h.isEnabled());
    t.end();
});

test('New Handler is enabled by default', (t) => {
    const map = createMap(t);
    const h = new Handler(map);
    t.ok(h.isEnabled(), 'should be enabled');
    t.end();
});

test('Methods .setOptions() and .getOptions() work as expected', (t) => {
    const map = createMap(t);
    const h = new Handler(map);
    t.deepEqual(h.getOptions(), {}, '.getOptions() should return options object');
    t.throws(() => h.setOptions({ happy: true }), /happy/, '.setOptions() should throw error on unrecognized options');
    h._options.happy = false;
    t.doesNotThrow(() => h.setOptions({ happy: true }), '.setOptions() should not throw error on recognized options');
    t.ok(h._options.happy, 'options should be set as ._options properties');
    t.deepEqual(h.getOptions(), { happy: true }, '.getOptions() should return the up to date options');
    t.end();
});

test('.processInputEvent() method delegates to event-type methods accordingly', (t) => {
    const warnings = [];
    t.stub(console, 'warn').callsFake((...args) => warnings.push(args.join(' ')));
    const map = createMap(t);
    const h = new Handler(map);
    const touchstart = new window.TouchEvent('touchstart', { touches: [{ clientX: 1, clientY: 1 }] });
    t.doesNotThrow(() => h.processInputEvent('notanevent'), '.processInputEvent() should not throw error, even for unrecognized event types');
    t.ok(/notanevent/.test(warnings[0]), 'should give appropriate warning if input event is not a valid type');
    t.doesNotThrow(() => h.processInputEvent(touchstart), '.processInputEvent() should not throw error, even for unrecognized event types');
    t.notOk(h.processInputEvent(touchstart), 'if no method exists for the event type, .processInputEvent() should return nothing');
    h.touchstart = function(e) { return e.touches[0].clientX; };
    t.equal(h.processInputEvent(touchstart), 1, 'if a method exists for the event type, .processInputEvent() should pass through its return value');
    t.end();
});
