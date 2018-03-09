import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';

function createMap() {
    return new Map({
        container: DOM.create('div', '', window.document.body),
        style: {
            "version": 8,
            "sources": {},
            "layers": []
        }
    });
}

test('Map#_requestRenderFrame schedules a new render frame if necessary', (t) => {
    const map = createMap();
    t.stub(map, '_rerender');
    map._requestRenderFrame(() => {});
    t.equal(map._rerender.callCount, 1);
    map.remove();
    t.end();
});

test('Map#_requestRenderFrame queues a task for the next render frame', (t) => {
    const map = createMap();
    const cb = t.spy();
    map._requestRenderFrame(cb);
    map.once('render', () => {
        t.equal(cb.callCount, 1);
        map.remove();
        t.end();
    });
});

test('Map#_cancelRenderFrame cancels a queued task', (t) => {
    const map = createMap();
    const cb = t.spy();
    const id = map._requestRenderFrame(cb);
    map._cancelRenderFrame(id);
    map.once('render', () => {
        t.equal(cb.callCount, 0);
        map.remove();
        t.end();
    });
});
