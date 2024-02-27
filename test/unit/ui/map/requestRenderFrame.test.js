import {test, expect, vi, createMap} from "../../../util/vitest.js";

test('Map#_requestRenderFrame schedules a new render frame if necessary', () => {
    const map = createMap();
    vi.spyOn(map, 'triggerRepaint').mockImplementation(() => {});
    map._requestRenderFrame(() => {});
    expect(map.triggerRepaint).toHaveBeenCalledTimes(1);
    map.remove();
});

test('Map#_requestRenderFrame queues a task for the next render frame', () => {
    const map = createMap();
    const cb = vi.fn();
    map._requestRenderFrame(cb);
    map.once('render', () => {
        expect(cb).toHaveBeenCalledTimes(1);
        map.remove();
    });
});

test('Map#_cancelRenderFrame cancels a queued task', () => {
    const map = createMap();
    const cb = vi.fn();
    const id = map._requestRenderFrame(cb);
    map._cancelRenderFrame(id);
    map.once('render', () => {
        expect(cb).not.toHaveBeenCalled(0);
        map.remove();
    });
});
