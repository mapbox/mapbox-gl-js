import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap() {
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag', (t) => {
    const map = createMap();

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

    simulate.mousemove(map.getCanvas());
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
    const map = createMap();

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

    simulate.mousemove(window.document.body);
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
    const map = createMap();

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

    simulate.touchmove(map.getCanvas());
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
    const map = createMap();

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

    simulate.touchmove(window.document.body);
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
    const map = createMap();

    const mousemove = t.spy();
    map.on('mousemove', mousemove);

    simulate.mousedown(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvasContainer());
    map._renderTaskQueue.run();

    t.ok(mousemove.notCalled);

    map.remove();
    t.end();
});

test('DragPanHandler ends a mouse-triggered drag if the window blurs', (t) => {
    const map = createMap();

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.blur(window);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler ends a touch-triggered drag if the window blurs', (t) => {
    const map = createMap();

    const dragend = t.spy();
    map.on('dragend', dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.blur(window);
    t.equal(dragend.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler requests a new render frame after each mousemove event', (t) => {
    const map = createMap();
    const requestFrame = t.spy(map, '_requestRenderFrame');

    simulate.mousedown(map.getCanvas());
    simulate.mousemove(map.getCanvas());
    t.ok(requestFrame.callCount > 0);

    map._renderTaskQueue.run();

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    requestFrame.reset();
    simulate.mousemove(map.getCanvas());
    t.equal(requestFrame.callCount, 1);

    map.remove();
    t.end();
});

test('DragPanHandler can interleave with another handler', (t) => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();

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

    simulate.mousemove(map.getCanvas());
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

    simulate.mousemove(map.getCanvas());
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
        const map = createMap();
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

        simulate.mousemove(map.getCanvas(), {[`${modifier}Key`]: true});
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
        const map = createMap();
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

        simulate.mousemove(map.getCanvas());
        map._renderTaskQueue.run();
        t.equal(dragstart.callCount, 0);
        t.equal(drag.callCount, 0);
        t.equal(dragend.callCount, 0);

        map.remove();
        t.end();
    });
});

test('DragPanHandler does not begin a drag on right button mousedown', (t) => {
    const map = createMap();
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

    simulate.mousemove(map.getCanvas(), {buttons: 2});
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
    const map = createMap();
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

    simulate.mousemove(map.getCanvas());
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

    simulate.mousemove(map.getCanvas());
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
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas());
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
    const map = createMap();

    map.on('touchstart', e => e.preventDefault());

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas());
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
    const map = createMap();

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

    simulate.touchmove(map.getCanvas());
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
        const map = createMap();

        map.on(event, () => map.dragPan.disable());

        const dragstart = t.spy();
        const drag      = t.spy();
        const dragend   = t.spy();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();

        simulate.mousemove(map.getCanvas());
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
    const map = createMap();

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    map.dragPan.disable();

    simulate.mousemove(map.getCanvas());
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
