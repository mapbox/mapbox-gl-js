import {test} from '../../../util/test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from '../../../util/simulate_interaction';
import DragPanHandler from '../../../../src/ui/handler/drag_pan';

function createMap(t, clickTolerance, dragPan) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({
        container: DOM.create('div', '', window.document.body),
        clickTolerance: clickTolerance || 0,
        dragPan: dragPan || true
    });
}

test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler captures mousemove events during a mouse-triggered drag (receives them even if they occur outside the map)', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(window.document.body, {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler captures touchmove events during a mouse-triggered drag (receives them even if they occur outside the map)', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(window.document.body, {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler prevents mousemove events from firing during a drag (#1555)', (t) => {
    const map = createMap(t);

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.mousedown(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvasContainer(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvasContainer());
    map._renderTaskQueue.run();

    t.ok(mousemove.notCalled);

    map.remove();
    t.end();
});

test('DragPanHandler ends a mouse-triggered drag if the window blurs', (t) => {
    const map = createMap(t);

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.blur(window);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler ends a touch-triggered drag if the window blurs', (t) => {
    const map = createMap(t);

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();

    simulate.blur(window);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler requests a new render frame after each mousemove event', (t) => {
    const map = createMap(t);
    const requestFrame = t.spy(map, '_requestRenderFrame');

    simulate.mousedown(map.getCanvas());
    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    t.ok(requestFrame.callCount > 0);

    map._renderTaskQueue.run();

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    requestFrame.resetHistory();
    simulate.mousemove(map.getCanvas(), {clientX: 20, clientY: 20});
    t.equal(requestFrame.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler can interleave with another handler', (t) => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    // simulate a scroll zoom
    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 20, clientY: 20});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

['ctrl', 'shift'].forEach((modifier) => {
    test(`DragPanHandler does not begin a drag if the ${modifier} key is down on mousedown`, (t) => {
        const map = createMap(t);
        map.dragRotate.disable();

        const dragstart = t.spy();
        const drag      = t.spy();
        const dragend   = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        simulate.mousemove(map.getCanvas(), {[`${modifier}Key`]: true, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        map.remove();
        t.end();
    });

    test(`DragPanHandler still ends a drag if the ${modifier} key is down on mouseup`, (t) => {
        const map = createMap(t);
        map.dragRotate.disable();

        const dragstart = t.spy();
        const drag      = t.spy();
        const dragend   = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        map.remove();
        t.end();
    });
});

test('DragPanHandler does not begin a drag on right button mousedown', (t) => {
    const map = createMap(t);
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not end a drag on right button mouseup', (t) => {
    const map = createMap(t);
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 20, clientY: 20});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the mousedown event', (t) => {
    const map = createMap(t);

    map.on('mousedown', e => e.preventDefault());

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event', (t) => {
    const map = createMap(t);

    map.on('touchstart', e => e.preventDefault());

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event (delegated)', (t) => {
    const map = createMap(t);

    t.stub(map, 'getLayer')
        .callsFake(() => true);
    t.stub(map, 'queryRenderedFeatures')
        .callsFake(() => [{}]);

    map.on('touchstart', 'point', (e) => {
        e.preventDefault();
    });

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

['dragstart', 'drag'].forEach(event => {
    test(`DragPanHandler can be disabled on ${event} (#2419)`, (t) => {
        const map = createMap(t);

        map.on(event, () => map.dragPan.disable());

        const dragstart = t.spy();
        const drag      = t.spy();
        const dragend   = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
        map._renderTaskQueue.run();

        t.equal(dragstart.callCount, 1);
        t.equal(drag.callCount, event === 'dragstart' ? 0 : 1);
        t.equal(dragend.callCount, 1);
        t.equal(map.isMoving(), false);
        t.equal(map.dragPan.isEnabled(), false);

        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();

        t.equal(dragstart.callCount, 1);
        t.equal(drag.callCount, event === 'dragstart' ? 0 : 1);
        t.equal(dragend.callCount, 1);
        t.equal(map.isMoving(), false);
        t.equal(map.dragPan.isEnabled(), false);

        map.remove();
        t.end();
    });
});

test(`DragPanHandler can be disabled after mousedown (#2419)`, (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    map.dragPan.disable();

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);
    t.equal(map.isMoving(), false);
    t.equal(map.dragPan.isEnabled(), false);

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);
    t.equal(map.isMoving(), false);
    t.equal(map.dragPan.isEnabled(), false);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag on spurious mousemove events', (t) => {
    const map = createMap(t);
    map.dragRotate.disable();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mouseup(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a drag on spurious touchmove events', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a mouse drag if moved less than click tolerance', (t) => {
    const map = createMap(t, 4);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 13, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 13});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {clientX: 14, clientY: 10});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a touch drag if moved less than click tolerance', (t) => {
    const map = createMap(t, 4);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 13, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 13}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 14, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler does not begin a touch drag on multi-finger touch event if zooming', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 10, clientY: 0}, {clientX: 20, clientY: 0}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 5, clientY: 10}, {clientX: 25, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('DragPanHandler starts a drag on a multi-finger no-zoom touch, and continues if it becomes a single-finger touch', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    map.on('dragstart', dragstart);

    const drag = t.spy();
    map.on('drag', drag);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 20, clientY: 20}, {clientX: 30, clientY: 30}]});
    map._renderTaskQueue.run();
    t.notOk(map.dragPan.isActive());
    t.equals(map.dragPan._state, 'pending');
    t.notOk(dragstart.called);
    t.notOk(drag.called);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}, {clientX: 20, clientY: 20}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);

    simulate.touchend(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);

    map.remove();
    t.end();
});

test('DragPanHandler stops/starts touch-triggered drag appropriately when transitioning between single- and multi-finger touch', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    // Single-finger touch starts drag
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}]});
    map._renderTaskQueue.run();
    t.notOk(map.dragPan.isActive());
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 20, clientY: 20}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    // Adding a second finger and panning (without zoom/rotate) continues the drag
    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}, {clientX: 20, clientY: 20}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 20}, {clientX: 20, clientY: 30}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 0);

    // Starting a two-finger zoom/rotate stops drag (will trigger touchZoomRotate instead)
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 20}, {clientX: 30, clientY: 30}]});
    map._renderTaskQueue.run();
    t.notOk(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 1);

    // Continuing to pan with two fingers does not start a drag (handled by touchZoomRotate instead)
    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 10, clientY: 10}, {clientX: 30, clientY: 20}]});
    map._renderTaskQueue.run();
    t.notOk(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 1);

    // Removing all but one finger starts another drag
    simulate.touchend(map.getCanvas(), {touches: [{clientX: 30, clientY: 20}]});
    map._renderTaskQueue.run();
    t.notOk(map.dragPan.isActive());
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 1);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 20, clientY: 20}]});
    map._renderTaskQueue.run();
    t.ok(map.dragPan.isActive());
    t.equal(dragstart.callCount, 2);
    t.equal(drag.callCount, 3);
    t.equal(dragend.callCount, 1);

    // Removing last finger stops drag
    simulate.touchend(map.getCanvas());
    map._renderTaskQueue.run();
    t.notOk(map.dragPan.isActive());
    t.equal(dragstart.callCount, 2);
    t.equal(drag.callCount, 3);
    t.equal(dragend.callCount, 2);

    map.remove();
    t.end();
});

test('DragPanHandler fires dragstart, drag, dragend events in response to multi-touch pan', (t) => {
    const map = createMap(t);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}, {clientX: 5, clientY: 0}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 10}, {clientX: 5, clientY: 10}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 1);
    t.equal(dragend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: [{clientX: 0, clientY: 5}, {clientX: 5, clientY: 5}]});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 0);

    simulate.touchend(map.getCanvas(), {touches: []});
    map._renderTaskQueue.run();
    t.equal(dragstart.callCount, 1);
    t.equal(drag.callCount, 2);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHander#enable gets called with dragPan map option parameters', (t) => {
    const enableSpy = t.spy(DragPanHandler.prototype, 'enable');
    const customParams = {
        linearity: 0.5,
        easing: (t) => t,
        maxSpeed: 1500,
        deceleration: 1900
    };
    const map = createMap(t, null, customParams);

    t.ok(enableSpy.calledWith(customParams));
    t.deepEqual(map.dragPan._inertiaOptions, customParams);
    t.end();
});
