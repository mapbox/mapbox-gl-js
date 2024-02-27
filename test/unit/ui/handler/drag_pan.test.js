import {test, expect, vi, createMap as globalCreateMap, waitFor, equalWithPrecision} from "../../../util/vitest.js";
import simulate, {constructTouch} from '../../../util/simulate_interaction.js';
import land from '../../../util/fixtures/land.json';

function createMap(clickTolerance, dragPan) {
    return globalCreateMap({
        clickTolerance: clickTolerance || 0,
        dragPan: dragPan || true,
        interactive: true
    });
}

// MouseEvent.buttons = 1 // left button
const buttons = 1;

test.skip('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a mouse-triggered drag', () => {
    const map = createMap();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(window.document);
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('DragPanHandler captures mousemove events during a mouse-triggered drag (receives them even if they occur outside the map)', () => {
    const map = createMap();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(window.document.body, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(window.document);
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

test.skip('DragPanHandler fires dragstart, drag, and dragend events at appropriate times in response to a touch-triggered drag', () => {
    const map = createMap();
    const target = map.getCanvas();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(target, {touches: [constructTouch(target, {target, clientX: 0, clientY: 0})]});
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.touchmove(target, {touches: [constructTouch(target, {target, clientX: 10, clientY: 10})]});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.touchend(target);
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('DragPanHandler prevents mousemove events from firing during a drag (#1555)', () => {
    const map = createMap();

    const mousemove = vi.fn();
    map.on('mousemove', mousemove);

    simulate.mousedown(map.getCanvasContainer());
    map._renderTaskQueue.run();

    simulate.mousemove(window.document, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(window.document);
    map._renderTaskQueue.run();

    expect(mousemove).not.toHaveBeenCalled();

    map.remove();
});

test('DragPanHandler ends a mouse-triggered drag if the window blurs', () => {
    const map = createMap();

    const dragend = vi.fn();
    map.on('dragend', dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(window.document, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.blur(window);
    map._renderTaskQueue.run();

    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('DragPanHandler does not end a touch-triggered drag if the window blurs', () => {
    const map = createMap();
    const target = map.getCanvas();

    const dragend = vi.fn();
    map.on('dragend', dragend);

    simulate.touchstart(target, {touches: [constructTouch(target, {target, clientX: 0, clientY: 0})]});
    map._renderTaskQueue.run();

    simulate.touchmove(target, {touches: [constructTouch(target, {target, clientX: 10, clientY: 10})]});
    map._renderTaskQueue.run();

    simulate.blur(window);
    map._renderTaskQueue.run();

    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test.skip('DragPanHandler does not end a touch-triggered drag if the window resizes', () => {
    const map = createMap();
    const target = map.getCanvas();

    const dragend = vi.fn();
    map.on('dragend', dragend);

    const drag = vi.fn();
    map.on('drag', drag);

    simulate.touchstart(target, {touches: [constructTouch(target, {target, clientX: 0, clientY: 0})]});
    map._renderTaskQueue.run();

    simulate.touchmove(target, {touches: [constructTouch(target, {target, clientX: 10, clientY: 10})]});
    map._renderTaskQueue.run();

    map.resize();

    simulate.touchmove(target, {touches: [constructTouch(target, {target, clientX: 20, clientY: 10})]});
    map._renderTaskQueue.run();

    simulate.touchend(target);
    map._renderTaskQueue.run();

    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('DragPanHandler requests a new render frame after each mousemove event', () => {
    const map = createMap();
    const requestFrame = vi.spyOn(map.handlers, '_requestFrame');

    simulate.mousedown(map.getCanvas());
    simulate.mousemove(window.document, {buttons, clientX: 10, clientY: 10});
    expect(requestFrame).toHaveBeenCalled();

    map._renderTaskQueue.run();

    // https://github.com/mapbox/mapbox-gl-js/issues/6063
    requestFrame.mockClear();
    simulate.mousemove(window.document, {buttons, clientX: 20, clientY: 20});
    expect(requestFrame).toHaveBeenCalledTimes(1);

    map.remove();
});

test('DragPanHandler can interleave with another handler', () => {
    // https://github.com/mapbox/mapbox-gl-js/issues/6106
    const map = createMap();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    // simulate a scroll zoom
    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {buttons, clientX: 20, clientY: 20});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(window.document);
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

['ctrl', 'shift'].forEach((modifier) => {
    test(`DragPanHandler does not begin a drag if the ${modifier} key is down on mousedown`, () => {
        const map = createMap();
        expect(map.dragRotate.isEnabled()).toBeTruthy();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas(), {buttons, [`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {buttons, [`${modifier}Key`]: true, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        map.remove();
    });

    test(`DragPanHandler still ends a drag if the ${modifier} key is down on mouseup`, () => {
        const map = createMap();
        expect(map.dragRotate.isEnabled()).toBeTruthy();

        const dragstart = vi.fn();
        const drag      = vi.fn();
        const dragend   = vi.fn();

        map.on('dragstart', dragstart);
        map.on('drag',      drag);
        map.on('dragend',   dragend);

        simulate.mousedown(map.getCanvas());
        map._renderTaskQueue.run();
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.mouseup(map.getCanvas(), {[`${modifier}Key`]: true});
        map._renderTaskQueue.run();
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
        map._renderTaskQueue.run();
        expect(dragstart).not.toHaveBeenCalled();
        expect(drag).not.toHaveBeenCalled();
        expect(dragend).not.toHaveBeenCalled();

        map.remove();
    });
});

test('DragPanHandler does not begin a drag on right button mousedown', () => {
    const map = createMap();
    map.dragRotate.disable();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('DragPanHandler does not end a drag on right button mouseup', () => {
    const map = createMap();
    map.dragRotate.disable();

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();
    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousedown(window.document, {buttons: buttons + 2, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(window.document, {buttons, button: 2});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(1);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {buttons, clientX: 20, clientY: 20});
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).not.toHaveBeenCalled();

    simulate.mouseup(window.document);
    map._renderTaskQueue.run();
    expect(dragstart).toHaveBeenCalledTimes(1);
    expect(drag).toHaveBeenCalledTimes(2);
    expect(dragend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the mousedown event', () => {
    const map = createMap();

    map.on('mousedown', e => e.preventDefault());

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();

    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event', () => {
    const map = createMap();
    const target = map.getCanvas();

    map.on('touchstart', e => e.preventDefault());

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, clientX: 0, clientY: 0})]});
    map._renderTaskQueue.run();

    simulate.touchmove(window.document, {touches: [constructTouch(target, {target, clientX: 10, clientY: 10})]});
    map._renderTaskQueue.run();

    simulate.touchend(window.document);
    map._renderTaskQueue.run();

    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('DragPanHandler does not begin a drag if preventDefault is called on the touchstart event (delegated)', () => {
    const map = createMap();
    const target = map.getCanvas();

    vi.spyOn(map, 'getLayer').mockImplementation(() => true);
    vi.spyOn(map, 'queryRenderedFeatures').mockImplementation(() => [{}]);

    map.on('touchstart', 'point', (e) => {
        e.preventDefault();
    });

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, clientX: 0, clientY: 0})]});
    map._renderTaskQueue.run();

    simulate.touchmove(window.document, {touches: [constructTouch(target, {target, clientX: 10, clientY: 10})]});
    map._renderTaskQueue.run();

    simulate.touchend(window.document);
    map._renderTaskQueue.run();

    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('Dragging to the left', async () => {
    const map = createMap({
        zoom: 1,
        fadeDuration: 0,
        center: [0, 0],
        style: {
            version: 9,
            sources: {
                land: {
                    type: 'geojson',
                    data: land
                }
            },
            layers: [
                {
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': '#72d0f2'
                    }
                },
                {
                    id: 'land',
                    type: 'fill',
                    source: 'land',
                    paint: {
                        'fill-color': '#f0e9e1'
                    }
                }
            ]
        }
    });

    await waitFor(map, 'load');

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(window.document, {buttons, clientX: 50, clientY: 0});
    map._renderTaskQueue.run();

    simulate.mouseup(window.document);
    map._renderTaskQueue.run();

    const {lat, lng} = map.getCenter();

    expect(equalWithPrecision(-35.15596, lng, 0.001)).toBeTruthy();
    expect(equalWithPrecision(-0.00029, lat, 0.001)).toBeTruthy();
});
