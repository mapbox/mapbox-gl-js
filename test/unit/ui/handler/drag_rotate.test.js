import { test } from 'mapbox-gl-js-test';
import util from '../../../../src/util/util';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap(options) {
    return new Map(util.extend({ container: DOM.create('div', '', window.document.body) }, options));
}

test('DragRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a right-click drag', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler stops firing events after mouseup', (t) => {
    const map = createMap();

    const spy = t.spy();
    map.on('rotatestart', spy);
    map.on('rotate',      spy);
    map.on('rotateend',   spy);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    t.equal(spy.callCount, 3);

    spy.reset();
    simulate.mousemove(map.getCanvas(), {buttons: 0});
    map._updateCamera();
    t.equal(spy.callCount, 0);

    map.remove();
    t.end();
});

test('DragRotateHandler fires rotatestart, rotate, and rotateend events at appropriate times in response to a control-left-click drag', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 1,            ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 0, ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler pitches in response to a right-click drag by default', (t) => {
    const map = createMap();

    const pitchstart = t.spy();
    const pitch      = t.spy();
    const pitchend   = t.spy();

    map.on('pitchstart', pitchstart);
    map.on('pitch',      pitch);
    map.on('pitchend',   pitchend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(pitchstart.callCount, 1);
    t.equal(pitch.callCount, 1);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    t.equal(pitchend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler pitches in response to a control-left-click drag', (t) => {
    const map = createMap();

    const pitchstart = t.spy();
    const pitch      = t.spy();
    const pitchend   = t.spy();

    map.on('pitchstart', pitchstart);
    map.on('pitch',      pitch);
    map.on('pitchend',   pitchend);

    simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {buttons: 1,            ctrlKey: true});
    map._updateCamera();
    t.equal(pitchstart.callCount, 1);
    t.equal(pitch.callCount, 1);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 0, ctrlKey: true});
    t.equal(pitchend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler does not pitch if given pitchWithRotate: false', (t) => {
    const map = createMap({pitchWithRotate: false});

    const spy = t.spy();

    map.on('pitchstart',  spy);
    map.on('pitch',       spy);
    map.on('pitchend',    spy);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});

    simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {buttons: 1,            ctrlKey: true});
    map._updateCamera();
    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 0, ctrlKey: true});

    t.ok(spy.notCalled);

    map.remove();
    t.end();
});

test('DragRotateHandler does not rotate or pitch when disabled', (t) => {
    const map = createMap();

    map.dragRotate.disable();

    const spy = t.spy();

    map.on('rotatestart', spy);
    map.on('rotate',      spy);
    map.on('rotateend',   spy);
    map.on('pitchstart',  spy);
    map.on('pitch',       spy);
    map.on('pitchend',    spy);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});

    t.ok(spy.notCalled);

    map.remove();
    t.end();
});

test('DragRotateHandler ensures that map.isMoving() returns true during drag', (t) => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({bearingSnap: 0});

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    t.ok(map.isMoving());

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    t.ok(!map.isMoving());

    map.remove();
    t.end();
});

test('DragRotateHandler fires move events', (t) => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({bearingSnap: 0});

    const movestart = t.spy();
    const move      = t.spy();
    const moveend   = t.spy();

    map.on('movestart', movestart);
    map.on('move',      move);
    map.on('moveend',   moveend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(movestart.callCount, 1);
    t.equal(move.callCount, 1);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    t.equal(moveend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler includes originalEvent property in triggered events', (t) => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({bearingSnap: 0});

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();
    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    const pitchstart = t.spy();
    const pitch      = t.spy();
    const pitchend   = t.spy();
    map.on('pitchstart', pitchstart);
    map.on('pitch',      pitch);
    map.on('pitchend',   pitchend);

    const movestart = t.spy();
    const move      = t.spy();
    const moveend   = t.spy();
    map.on('movestart', movestart);
    map.on('move',      move);
    map.on('moveend',   moveend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});

    t.ok(rotatestart.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(pitchstart.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(movestart.firstCall.args[0].originalEvent.type, 'mousemove');

    t.ok(rotate.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(pitch.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(move.firstCall.args[0].originalEvent.type, 'mousemove');

    t.ok(rotateend.firstCall.args[0].originalEvent.type, 'mouseup');
    t.ok(pitchend.firstCall.args[0].originalEvent.type, 'mouseup');
    t.ok(moveend.firstCall.args[0].originalEvent.type, 'mouseup');

    map.remove();
    t.end();
});

test('DragRotateHandler responds to events on the canvas container (#1301)', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvasContainer(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvasContainer(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);

    simulate.mouseup(map.getCanvasContainer(),   {buttons: 0, button: 2});
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler prevents mousemove events from firing during a drag (#1555)', (t) => {
    const map = createMap();

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.mousedown(map.getCanvasContainer(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvasContainer(), {buttons: 2});
    map._updateCamera();
    simulate.mouseup(map.getCanvasContainer(),   {buttons: 0, button: 2});

    t.ok(mousemove.notCalled);

    map.remove();
    t.end();
});

test('DragRotateHandler ends a control-left-click drag on mouseup even when the control key was previously released (#1888)', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {buttons: 1,            ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 0, ctrlKey: false});
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler ends rotation if the window blurs (#3389)', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);

    simulate.blur(window);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler requests a new render frame after each mousemove event', (t) => {
    const map = createMap();
    const update = t.spy(map, '_update');

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    t.ok(update.callCount > 0);

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    update.reset();
    simulate.mousemove(map.getCanvas(), {buttons: 2});
    t.equal(update.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler can interleave with another handler', (t) => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    // simulates another handler taking over
    map.stop();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler does not begin a drag on left-button mousedown without the control key', (t) => {
    const map = createMap();
    map.dragPan.disable();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas());
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas());
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas());
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    map.remove();
    t.end();
});

test('DragRotateHandler does not end a right-button drag on left-button mouseup', (t) => {
    const map = createMap();
    map.dragPan.disable();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mousedown(map.getCanvas(), {buttons: 3, button: 0});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 2, button: 0});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler does not end a control-left-button drag on right-button mouseup', (t) => {
    const map = createMap();
    map.dragPan.disable();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 1, button: 0, ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 1,            ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mousedown(map.getCanvas(), {buttons: 3, button: 2, ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 1, button: 2, ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 1);
    t.equal(rotateend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 1,            ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 0, ctrlKey: true});
    map._updateCamera();
    t.equal(rotatestart.callCount, 1);
    t.equal(rotate.callCount, 2);
    t.equal(rotateend.callCount, 1);

    map.remove();
    t.end();
});

test('DragRotateHandler does not begin a drag if preventDefault is called on the mousedown event', (t) => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._updateCamera();

    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);

    map.remove();
    t.end();
});

['rotatestart', 'rotate'].forEach(event => {
    test(`DragRotateHandler can be disabled on ${event} (#2419)`, (t) => {
        const map = createMap();

        map.on(event, () => map.dragRotate.disable());

        const rotatestart = t.spy();
        const rotate      = t.spy();
        const rotateend   = t.spy();

        map.on('rotatestart', rotatestart);
        map.on('rotate',      rotate);
        map.on('rotateend',   rotateend);

        simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
        map._updateCamera();

        simulate.mousemove(map.getCanvas(), {buttons: 2});
        map._updateCamera();

        t.equal(rotatestart.callCount, 1);
        t.equal(rotate.callCount, event === 'rotatestart' ? 0 : 1);
        t.equal(rotateend.callCount, 1);
        t.equal(map.isMoving(), false);
        t.equal(map.dragRotate.isEnabled(), false);

        simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2});
        map._updateCamera();

        t.equal(rotatestart.callCount, 1);
        t.equal(rotate.callCount, event === 'rotatestart' ? 0 : 1);
        t.equal(rotateend.callCount, 1);
        t.equal(map.isMoving(), false);
        t.equal(map.dragRotate.isEnabled(), false);

        map.remove();
        t.end();
    });
});

test(`DragRotateHandler can be disabled after mousedown (#2419)`, (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._updateCamera();

    map.dragRotate.disable();

    simulate.mousemove(map.getCanvas(), {buttons: 2});
    map._updateCamera();

    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);
    t.equal(map.isMoving(), false);
    t.equal(map.dragRotate.isEnabled(), false);

    simulate.mouseup(map.getCanvas(), {buttons: 0, button: 2});
    map._updateCamera();

    t.equal(rotatestart.callCount, 0);
    t.equal(rotate.callCount, 0);
    t.equal(rotateend.callCount, 0);
    t.equal(map.isMoving(), false);
    t.equal(map.dragRotate.isEnabled(), false);

    map.remove();
    t.end();
});
