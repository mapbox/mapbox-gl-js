import { test } from 'mapbox-gl-js-test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from 'mapbox-gl-js-test/simulate_interaction';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({ container: DOM.create('div', '', window.document.body) });
}

test('DoubleClickZoomHandler zooms on dblclick event', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    t.ok(zoom.called);

    map.remove();
    t.end();
});

test('DoubleClickZoomHandler does not zoom if preventDefault is called on the dblclick event', (t) => {
    const map = createMap(t);

    map.on('dblclick', e => e.preventDefault());

    const zoom = t.spy();
    map.on('zoom', zoom);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    t.equal(zoom.callCount, 0);

    map.remove();
    t.end();
});

test('DoubleClickZoomHandler zooms on double tap if touchstart events are < 300ms apart', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    const simulateDoubleTap = () => {
        return new Promise(resolve => {
            simulate.touchstart(map.getCanvas());
            simulate.touchend(map.getCanvas());
            setTimeout(() => {
                simulate.touchstart(map.getCanvas());
                simulate.touchend(map.getCanvas());
                map._renderTaskQueue.run();
                resolve();
            }, 100);
        });
    };

    simulateDoubleTap(map, 100).then(() => {
        t.ok(zoom.called);

        map.remove();
        t.end();
    });

});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are > 300ms apart', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    const simulateDelayedDoubleTap = () => {
        return new Promise(resolve => {
            simulate.touchstart(map.getCanvas());
            simulate.touchend(map.getCanvas());
            setTimeout(() => {
                simulate.touchstart(map.getCanvas());
                simulate.touchend(map.getCanvas());
                map._renderTaskQueue.run();
                resolve();
            }, 300);
        });
    };

    simulateDelayedDoubleTap().then(() => {
        t.equal(zoom.callCount, 0);

        map.remove();
        t.end();
    });

});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are in different locations', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    const simulateTwoDifferentTaps = () => {
        return new Promise(resolve => {
            simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0, clientY: 0}]});
            simulate.touchend(map.getCanvas());
            setTimeout(() => {
                simulate.touchstart(map.getCanvas(), {touches: [{clientX: 0.5, clientY: 0.5}]});
                simulate.touchend(map.getCanvas());
                map._renderTaskQueue.run();
                resolve();
            }, 100);
        });
    };

    simulateTwoDifferentTaps().then(() => {
        t.equal(zoom.callCount, 0);

        map.remove();
        t.end();
    });

});
