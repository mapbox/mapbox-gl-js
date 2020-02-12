import {test} from '../../../util/test';
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

test('KeyboardHandler responds to keydown events', (t) => {
    const map = createMap(t);
    const h = map.keyboard;
    t.spy(h, 'keydown');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    t.ok(h.keydown.called, 'handler keydown method should be called on keydown event');
    t.equal(h.keydown.getCall(0).args[0].keyCode, 32, 'keydown method should be called with the correct event');
    t.end();
});

test('KeyboardHandler pans map in response to arrow keys', (t) => {
    const map = createMap(t, {zoom: 10, center: [0, 0]});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    t.notOk(map.easeTo.called, 'pressing a non-arrow key should have no effect');

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft"});
    t.ok(map.easeTo.called, 'pressing the left arrow key should trigger an easeTo animation');
    let easeToArgs = map.easeTo.getCall(0).args[0];
    t.equal(easeToArgs.offset[0], 100, 'pressing the left arrow key should offset map positively in X direction');
    t.equal(easeToArgs.offset[1], 0, 'pressing the left arrow key should not offset map in Y direction');

    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight"});
    t.ok(map.easeTo.callCount === 2, 'pressing the right arrow key should trigger an easeTo animation');
    easeToArgs = map.easeTo.getCall(1).args[0];
    t.equal(easeToArgs.offset[0], -100, 'pressing the right arrow key should offset map negatively in X direction');
    t.equal(easeToArgs.offset[1], 0, 'pressing the right arrow key should not offset map in Y direction');

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown"});
    t.ok(map.easeTo.callCount === 3, 'pressing the down arrow key should trigger an easeTo animation');
    easeToArgs = map.easeTo.getCall(2).args[0];
    t.equal(easeToArgs.offset[0], 0, 'pressing the down arrow key should not offset map in X direction');
    t.equal(easeToArgs.offset[1], -100, 'pressing the down arrow key should offset map negatively in Y direction');

    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp"});
    t.ok(map.easeTo.callCount === 4, 'pressing the up arrow key should trigger an easeTo animation');
    easeToArgs = map.easeTo.getCall(3).args[0];
    t.equal(easeToArgs.offset[0], 0, 'pressing the up arrow key should not offset map in X direction');
    t.equal(easeToArgs.offset[1], 100, 'pressing the up arrow key should offset map positively in Y direction');

    t.end();
});

test('KeyboardHandler rotates map in response to Shift+left/right arrow keys', async (t) => {
    const map = createMap(t, {zoom: 10, center: [0, 0], bearing: 0});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    t.notOk(map.easeTo.called, 'pressing a non-arrow key should have no effect');

    simulate.keydown(map.getCanvas(), {keyCode: 37, key: "ArrowLeft", shiftKey: true});
    t.ok(map.easeTo.called, 'pressing Shift + left arrow key should trigger an easeTo animation');
    let easeToArgs = map.easeTo.getCall(0).args[0];
    t.equal(easeToArgs.bearing, -15, 'pressing Shift + left arrow key should rotate map clockwise');
    t.equal(easeToArgs.offset[0], 0, 'pressing Shift + left arrow key should not offset map in X direction');

    map.setBearing(0);
    simulate.keydown(map.getCanvas(), {keyCode: 39, key: "ArrowRight", shiftKey: true});
    t.ok(map.easeTo.callCount === 2, 'pressing Shift + right arrow key should trigger an easeTo animation');
    easeToArgs = map.easeTo.getCall(1).args[0];
    t.equal(easeToArgs.bearing, 15, 'pressing Shift + right arrow key should rotate map counterclockwise');
    t.equal(easeToArgs.offset[0], 0, 'pressing Shift + right arrow key should not offset map in X direction');

    t.end();
});

test('KeyboardHandler pitches map in response to Shift+up/down arrow keys', async (t) => {
    const map = createMap(t, {zoom: 10, center: [0, 0], pitch: 30});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 32, key: " "});
    t.notOk(map.easeTo.called, 'pressing a non-arrow key should have no effect');

    simulate.keydown(map.getCanvas(), {keyCode: 40, key: "ArrowDown", shiftKey: true});
    t.ok(map.easeTo.called, 'pressing Shift + down arrow key should trigger an easeTo animation');
    let easeToArgs = map.easeTo.getCall(0).args[0];
    t.equal(easeToArgs.pitch, 20, 'pressing Shift + down arrow key should pitch map less');
    t.equal(easeToArgs.offset[1], 0, 'pressing Shift + down arrow key should not offset map in Y direction');

    map.setPitch(30);
    simulate.keydown(map.getCanvas(), {keyCode: 38, key: "ArrowUp", shiftKey: true});
    t.ok(map.easeTo.callCount === 2, 'pressing Shift + up arrow key should trigger an easeTo animation');
    easeToArgs = map.easeTo.getCall(1).args[0];
    t.equal(easeToArgs.pitch, 40, 'pressing Shift + up arrow key should pitch map more');
    t.equal(easeToArgs.offset[1], 0, 'pressing Shift + up arrow key should not offset map in Y direction');

    t.end();
});

test('KeyboardHandler zooms map in response to -/+ keys', (t) => {
    const map = createMap(t, {zoom: 10, center: [0, 0]});
    t.spy(map, 'easeTo');

    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal"});
    t.equal(map.easeTo.callCount, 1, 'pressing the +/= key should trigger an easeTo animation');
    t.equal(map.easeTo.getCall(0).args[0].zoom, 11, 'pressing the +/= key should zoom map in');

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 187, key: "Equal", shiftKey: true});
    t.equal(map.easeTo.callCount, 2, 'pressing Shift + +/= key should trigger an easeTo animation');
    t.equal(map.easeTo.getCall(1).args[0].zoom, 12, 'pressing Shift + +/= key should zoom map in more');

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus"});
    t.equal(map.easeTo.callCount, 3, 'pressing the -/_ key should trigger an easeTo animation');
    t.equal(map.easeTo.getCall(2).args[0].zoom, 9, 'pressing the -/_ key should zoom map out');

    map.setZoom(10);
    simulate.keydown(map.getCanvas(), {keyCode: 189, key: "Minus", shiftKey: true});
    t.equal(map.easeTo.callCount, 4, 'pressing Shift + -/_ key should trigger an easeTo animation');
    t.equal(map.easeTo.getCall(3).args[0].zoom, 8, 'pressing Shift + -/_ key should zoom map out more');

    t.end();
});
