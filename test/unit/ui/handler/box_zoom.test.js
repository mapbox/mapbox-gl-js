import {test, expect, vi, createMap} from "../../../util/vitest.js";
import simulate from '../../../util/simulate_interaction.js';

test('BoxZoomHandler fires boxzoomstart and boxzoomend events at appropriate times', () => {
    const map = createMap({
        interactive: true
    });

    const boxzoomstart = vi.fn();
    const boxzoomend   = vi.fn();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    expect(boxzoomstart).toHaveBeenCalledTimes(1);
    expect(boxzoomend).not.toHaveBeenCalled();

    simulate.mouseup(window.document, {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    expect(boxzoomstart).toHaveBeenCalledTimes(1);
    expect(boxzoomend).toHaveBeenCalledTimes(1);

    map.remove();
});

test('BoxZoomHandler fires boxzoomcancel events at the appropriate time', () => {
    const map = createMap({
        interactive: true
    });

    const boxzoomcancel = vi.fn();

    map.on('boxzoomcancel', boxzoomcancel);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomcancel).not.toHaveBeenCalled();

    simulate.mouseup(window.document, {shiftKey: false, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomcancel).toHaveBeenCalledTimes(1);

    map.remove();
});

test('BoxZoomHandler avoids conflicts with DragPanHandler when disabled and reenabled (#2237)', () => {
    const map = createMap({
        interactive: true
    });

    map.boxZoom.disable();
    map.boxZoom.enable();

    const boxzoomstart = vi.fn();
    const boxzoomend   = vi.fn();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    const dragstart = vi.fn();
    const drag      = vi.fn();
    const dragend   = vi.fn();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    expect(boxzoomstart).toHaveBeenCalledTimes(1);
    expect(boxzoomend).not.toHaveBeenCalled();

    simulate.mouseup(window.document, {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    expect(boxzoomstart).toHaveBeenCalledTimes(1);
    expect(boxzoomend).toHaveBeenCalledTimes(1);

    expect(dragstart).not.toHaveBeenCalled();
    expect(drag).not.toHaveBeenCalled();
    expect(dragend).not.toHaveBeenCalled();

    map.remove();
});

test('BoxZoomHandler does not begin a box zoom if preventDefault is called on the mousedown event', () => {
    const map = createMap({
        interactive: true
    });

    map.on('mousedown', e => e.preventDefault());

    const boxzoomstart = vi.fn();
    const boxzoomend   = vi.fn();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();

    simulate.mousemove(window.document, {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();

    simulate.mouseup(window.document, {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();

    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();

    map.remove();
});

test('BoxZoomHandler cancels a box zoom on spurious mousemove events', () => {
    const map = createMap({
        interactive: true
    });

    const boxzoomstart = vi.fn();
    const boxzoomend   = vi.fn();
    const boxzoomcancel = vi.fn();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);
    map.on('boxzoomcancel', boxzoomcancel);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();
    expect(boxzoomcancel).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();
    expect(boxzoomcancel).not.toHaveBeenCalled();

    simulate.mouseup(window.document, {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();
    expect(boxzoomcancel).toHaveBeenCalledTimes(1);

    map.remove();
});

test('BoxZoomHandler does not begin a box zoom until mouse move is larger than click tolerance', () => {
    const map = createMap({
        interactive: true,
        clickTolerance: 4
    });

    const boxzoomstart = vi.fn();
    const boxzoomend   = vi.fn();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {shiftKey: true, clientX: 3, clientY: 0});
    map._renderTaskQueue.run();
    expect(boxzoomstart).not.toHaveBeenCalled();
    expect(boxzoomend).not.toHaveBeenCalled();

    simulate.mousemove(window.document, {shiftKey: true, clientX: 0, clientY: 4});
    map._renderTaskQueue.run();
    expect(boxzoomstart).toHaveBeenCalledTimes(1);
    expect(boxzoomend).not.toHaveBeenCalled();

    map.remove();
});
