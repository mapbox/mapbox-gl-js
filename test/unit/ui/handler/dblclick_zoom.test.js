import {test} from '../../../util/test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({container: DOM.create('div', '', window.document.body)});
}

function simulateDoubleTap(map, delay = 100) {
    const canvas = map.getCanvas();
    return new Promise(resolve => {
        simulate.touchstart(canvas);
        simulate.touchend(canvas);
        setTimeout(() => {
            simulate.touchstart(canvas);
            simulate.touchend(canvas);
            map._renderTaskQueue.run();
            resolve();
        }, delay);
    });
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

    simulateDoubleTap(map, 300).then(() => {
        t.equal(zoom.callCount, 0);

        map.remove();
        t.end();
    });

});

test('DoubleClickZoomHandler does not zoom on double tap if touchstart events are in different locations', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    const canvas = map.getCanvas();

    const simulateTwoDifferentTaps = () => {
        return new Promise(resolve => {
            simulate.touchstart(canvas, {touches: [{clientX: 0, clientY: 0}]});
            simulate.touchend(canvas);
            setTimeout(() => {
                simulate.touchstart(canvas, {touches: [{clientX: 30.5, clientY: 30.5}]});
                simulate.touchend(canvas);
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

test('DoubleClickZoomHandler zooms on the second touchend event of a double tap', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    const canvas = map.getCanvas();
    const touchOptions = {touches: [{clientX: 0.5, clientY: 0.5}]};

    simulate.touchstart(canvas, touchOptions);
    simulate.touchend(canvas);
    simulate.touchstart(canvas, touchOptions);
    map._renderTaskQueue.run();
    t.notOk(zoom.called, 'should not trigger zoom before second touchend');

    simulate.touchcancel(canvas);
    simulate.touchend(canvas);
    map._renderTaskQueue.run();
    t.notOk(zoom.called, 'should not trigger zoom if second touch is canceled');

    simulate.touchstart(canvas, touchOptions);
    simulate.touchend(canvas);
    simulate.touchstart(canvas, touchOptions);
    map._renderTaskQueue.run();
    t.notOk(zoom.called);

    simulate.touchend(canvas);
    map._renderTaskQueue.run();

    t.ok(zoom.called, 'should trigger zoom after second touchend');
    t.deepEquals(zoom.getCall(0).args[0].point, {x: 0.5, y: 0.5}, 'should zoom to correct point');

    t.end();
});

test('DoubleClickZoomHandler does not zoom on double tap if second touchend is >300ms after first touchstart', (t) => {
    const map = createMap(t);

    const zoom = t.spy();
    map.on('zoom', zoom);

    const canvas = map.getCanvas();

    const simulateSlowSecondTap = () => {
        return new Promise(resolve => {
            simulate.touchstart(canvas);
            simulate.touchend(canvas);
            simulate.touchstart(canvas);
            setTimeout(() => {
                simulate.touchend(canvas);
                map._renderTaskQueue.run();
                resolve();
            }, 300);
        });
    };

    simulateSlowSecondTap().then(() => {
        t.notOk(zoom.called);

        t.end();
    });
});
