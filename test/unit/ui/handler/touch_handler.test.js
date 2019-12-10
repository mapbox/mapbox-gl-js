import {test} from '../../../util/test';
import TouchHandler from '../../../../src/ui/handler/touch';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';


function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({
        container: DOM.create('div', '', window.document.body),
    });
}


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
