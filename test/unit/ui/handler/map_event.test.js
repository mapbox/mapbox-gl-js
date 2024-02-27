import {test, expect, vi, createMap} from "../../../util/vitest.js";
import simulate, {constructTouch} from '../../../util/simulate_interaction.js';

test('MapEvent handler fires touch events with correct values', () => {
    const map = createMap();
    const target = map.getCanvas();

    const touchstart = vi.fn();
    const touchmove = vi.fn();
    const touchend = vi.fn();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);

    const touchesStart = [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 50})];
    const touchesMove = [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 60})];
    const touchesEnd = [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 60})];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchstart.mock.calls[0][0].point).toEqual({x: 0, y: 50});
    expect(touchmove).not.toHaveBeenCalled();
    expect(touchend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchmove.mock.calls[0][0].point).toEqual({x: 0, y: 60});
    expect(touchend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchend).toHaveBeenCalledTimes(1);
    expect(touchend.mock.calls[0][0].point).toEqual({x: 0, y: 60});

    map.remove();
});

test('MapEvent handler fires touchmove even while drag handler is active', () => {
    const map = createMap();
    const target = map.getCanvas();
    map.dragPan.enable();

    const touchstart = vi.fn();
    const touchmove = vi.fn();
    const touchend = vi.fn();
    const drag = vi.fn();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);
    map.on('drag', drag);

    const touchesStart = [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 50})];
    const touchesMove = [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 60})];
    const touchesEnd = [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: 60})];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchstart.mock.calls[0][0].point).toEqual({x: 0, y: 50});
    expect(touchmove).not.toHaveBeenCalled();
    expect(touchend).not.toHaveBeenCalled();

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchmove.mock.calls[0][0].point).toEqual({x: 0, y: 60});
    expect(touchend).not.toHaveBeenCalled();

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    expect(touchstart).toHaveBeenCalledTimes(1);
    expect(touchmove).toHaveBeenCalledTimes(1);
    expect(touchend).toHaveBeenCalledTimes(1);
    expect(touchend.mock.calls[0][0].point).toEqual({x: 0, y: 60});

    map._renderTaskQueue.run();
    expect(drag).toHaveBeenCalledTimes(1);

    map.remove();
});

test('MapEvent handler fires mousemove even while scroll handler is active', () => {
    const map = createMap();
    map.scrollZoom.enable();
    map.dragPan.enable();

    const wheel = vi.fn();
    const mousemove = vi.fn();
    const zoom = vi.fn();

    map.on('wheel', wheel);
    map.on('mousemove', mousemove);
    map.on('zoomstart', zoom);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    expect(wheel).toHaveBeenCalledTimes(1);

    simulate.mousemove(map.getCanvas(), {buttons: 0, clientX: 10, clientY: 10});
    expect(mousemove).toHaveBeenCalledTimes(1);
    expect(mousemove.mock.calls[0][0].point).toEqual({x: 10, y: 10});

    map._renderTaskQueue.run();
    expect(zoom).toHaveBeenCalledTimes(1);
});
