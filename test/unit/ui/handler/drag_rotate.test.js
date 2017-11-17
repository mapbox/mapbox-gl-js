'use strict';

const test = require('mapbox-gl-js-test').test;
const util = require('../../../../src/util/util');
const window = require('../../../../src/util/window');
const Map = require('../../../../src/ui/map');
const DOM = require('../../../../src/util/dom');
const simulate = require('mapbox-gl-js-test/simulate_interaction');

function createMap(options) {
    return new Map(util.extend({
        container: DOM.create('div', '', window.document.body),
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    }, options));
}

test('DragRotateHandler rotates in response to a right-click drag', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.ok(rotatestart.calledOnce);
    t.ok(rotate.calledOnce);

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});
    t.ok(rotateend.calledOnce);

    map.remove();
    t.end();
});

test('DragRotateHandler stops rotating after mouseup', (t) => {
    const map = createMap();

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});

    const spy = t.spy();

    map.on('rotatestart', spy);
    map.on('rotate',      spy);
    map.on('rotateend',   spy);

    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 0});

    t.ok(spy.notCalled);
    t.end();
});

test('DragRotateHandler rotates in response to a control-left-click drag', (t) => {
    const map = createMap();

    const rotatestart = t.spy();
    const rotate      = t.spy();
    const rotateend   = t.spy();

    map.on('rotatestart', rotatestart);
    map.on('rotate',      rotate);
    map.on('rotateend',   rotateend);

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 1,            ctrlKey: true});
    t.ok(rotatestart.calledOnce);
    t.ok(rotate.calledOnce);

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 0, ctrlKey: true});
    t.ok(rotateend.calledOnce);

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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.ok(pitchstart.calledOnce);
    t.ok(pitch.calledOnce);

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});
    t.ok(pitchend.calledOnce);

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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 1,            ctrlKey: true});
    t.ok(pitchstart.calledOnce);
    t.ok(pitch.calledOnce);

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 0, ctrlKey: true});
    t.ok(pitchend.calledOnce);

    t.end();
});

test('DragRotateHandler does not pitch if given pitchWithRotate: false', (t) => {
    const map = createMap({pitchWithRotate: false});

    const spy = t.spy();

    map.on('pitchstart',  spy);
    map.on('pitch',       spy);
    map.on('pitchend',    spy);

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 1,            ctrlKey: true});
    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 0, ctrlKey: true});

    t.ok(spy.notCalled);
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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});

    t.ok(spy.notCalled);
    t.end();
});

test('DragRotateHandler ensures that map.isMoving() returns true during drag', (t) => {
    // The bearingSnap option here ensures that the moveend event is sent synchronously.
    const map = createMap({bearingSnap: 0});

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.ok(map.isMoving());

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});
    t.ok(!map.isMoving());

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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.ok(movestart.calledOnce);
    t.ok(move.calledOnce);

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});
    t.ok(moveend.calledOnce);

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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 2});

    t.ok(rotatestart.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(pitchstart.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(movestart.firstCall.args[0].originalEvent.type, 'mousemove');

    t.ok(rotate.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(pitch.firstCall.args[0].originalEvent.type, 'mousemove');
    t.ok(move.firstCall.args[0].originalEvent.type, 'mousemove');

    t.ok(rotateend.firstCall.args[0].originalEvent.type, 'mouseup');
    t.ok(pitchend.firstCall.args[0].originalEvent.type, 'mouseup');
    t.ok(moveend.firstCall.args[0].originalEvent.type, 'mouseup');

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

    simulate.mousedown(map.getCanvasContainer(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvasContainer(), {bubbles: true, buttons: 2});
    t.ok(rotatestart.calledOnce);
    t.ok(rotate.calledOnce);

    simulate.mouseup(map.getCanvasContainer(),   {bubbles: true, buttons: 0, button: 2});
    t.ok(rotateend.calledOnce);

    t.end();
});

test('DragRotateHandler prevents mousemove events from firing during a drag (#1555)', (t) => {
    const map = createMap();

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.mousedown(map.getCanvasContainer(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvasContainer(), {bubbles: true, buttons: 2});
    simulate.mouseup(map.getCanvasContainer(),   {bubbles: true, buttons: 0, button: 2});

    t.ok(mousemove.notCalled);
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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 1, button: 0, ctrlKey: true});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 1,            ctrlKey: true});
    t.ok(rotatestart.calledOnce);
    t.ok(rotate.calledOnce);

    simulate.mouseup(map.getCanvas(),   {bubbles: true, buttons: 0, button: 0, ctrlKey: false});
    t.ok(rotateend.calledOnce);

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

    simulate.mousedown(map.getCanvas(), {bubbles: true, buttons: 2, button: 2});
    simulate.mousemove(map.getCanvas(), {bubbles: true, buttons: 2});
    t.ok(rotatestart.calledOnce);
    t.ok(rotate.calledOnce);

    simulate.blur(window);
    t.ok(rotateend.calledOnce);

    t.end();
});
