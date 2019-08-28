import {test} from '../../../util/test';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap(t, clickTolerance) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({container: DOM.create('div', '', window.document.body), clickTolerance});
}

test('BoxZoomHandler fires boxzoomstart and boxzoomend events at appropriate times', (t) => {
    const map = createMap(t);

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 0);

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 1);

    map.remove();
    t.end();
});

test('BoxZoomHandler avoids conflicts with DragPanHandler when disabled and reenabled (#2237)', (t) => {
    const map = createMap(t);

    map.boxZoom.disable();
    map.boxZoom.enable();

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    const dragstart = t.spy();
    const drag      = t.spy();
    const dragend   = t.spy();

    map.on('dragstart', dragstart);
    map.on('drag',      drag);
    map.on('dragend',   dragend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 0);

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 1);

    t.equal(dragstart.callCount, 0);
    t.equal(drag.callCount, 0);
    t.equal(dragend.callCount, 0);

    map.remove();
    t.end();
});

test('BoxZoomHandler does not begin a box zoom if preventDefault is called on the mousedown event', (t) => {
    const map = createMap(t);

    map.on('mousedown', e => e.preventDefault());

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 5, clientY: 5});
    map._renderTaskQueue.run();

    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    map.remove();
    t.end();
});

test('BoxZoomHandler does not begin a box zoom on spurious mousemove events', (t) => {
    const map = createMap(t);

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mouseup(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    map.remove();
    t.end();
});

test('BoxZoomHandler does not begin a box zoom until mouse move is larger than click tolerance', (t) => {
    const map = createMap(t, 4);

    const boxzoomstart = t.spy();
    const boxzoomend   = t.spy();

    map.on('boxzoomstart', boxzoomstart);
    map.on('boxzoomend',   boxzoomend);

    simulate.mousedown(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 3, clientY: 0});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 0);
    t.equal(boxzoomend.callCount, 0);

    simulate.mousemove(map.getCanvas(), {shiftKey: true, clientX: 0, clientY: 4});
    map._renderTaskQueue.run();
    t.equal(boxzoomstart.callCount, 1);
    t.equal(boxzoomend.callCount, 0);

    map.remove();
    t.end();
});
