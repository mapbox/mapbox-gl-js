import { test } from 'mapbox-gl-js-test';
import { createMap } from '../../../util';

test('Map#_requestRenderFrame schedules a new render frame if necessary', (t) => {
    const map = createMap(t);
    t.stub(map, 'triggerRepaint');
    map._requestRenderFrame(() => {});
    t.equal(map.triggerRepaint.callCount, 1);
    map.remove();
    t.end();
});

test('Map#_requestRenderFrame queues a task for the next render frame', (t) => {
    const map = createMap(t);
    const cb = t.spy();
    map._requestRenderFrame(cb);
    map.once('render', () => {
        t.equal(cb.callCount, 1);
        map.remove();
        t.end();
    });
});

test('Map#_cancelRenderFrame cancels a queued task', (t) => {
    const map = createMap(t);
    const cb = t.spy();
    const id = map._requestRenderFrame(cb);
    map._cancelRenderFrame(id);
    map.once('render', () => {
        t.equal(cb.callCount, 0);
        map.remove();
        t.end();
    });
});
