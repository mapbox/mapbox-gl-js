import {test} from '../../../util/test.js';
import window from '../../../../src/util/window.js';
import Map from '../../../../src/ui/map.js';
import DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    t.stub(Map.prototype, '_authenticate');
    return new Map({interactive: false, container: DOM.create('div', '', window.document.body)});
}

test('MapEvent handler fires touch events with correct values', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();

    const touchstart = t.spy();
    const touchmove = t.spy();
    const touchend = t.spy();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);

    const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
    const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
    const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    t.equal(touchstart.callCount, 1);
    t.deepEqual(touchstart.getCall(0).args[0].point, {x: 0, y: 50});
    t.equal(touchmove.callCount, 0);
    t.equal(touchend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    t.equal(touchstart.callCount, 1);
    t.equal(touchmove.callCount, 1);
    t.deepEqual(touchmove.getCall(0).args[0].point, {x: 0, y: 60});
    t.equal(touchend.callCount, 0);

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    t.equal(touchstart.callCount, 1);
    t.equal(touchmove.callCount, 1);
    t.equal(touchend.callCount, 1);
    t.deepEqual(touchend.getCall(0).args[0].point, {x: 0, y: 60});

    map.remove();
    t.end();
});

test('MapEvent handler fires touchmove even while drag handler is active', (t) => {
    const map = createMap(t);
    const target = map.getCanvas();
    map.dragPan.enable();

    const touchstart = t.spy();
    const touchmove = t.spy();
    const touchend = t.spy();
    const drag = t.spy();

    map.on('touchstart', touchstart);
    map.on('touchmove', touchmove);
    map.on('touchend', touchend);
    map.on('drag', drag);

    const touchesStart = [{target, identifier: 1, clientX: 0, clientY: 50}];
    const touchesMove = [{target, identifier: 1, clientX: 0, clientY: 60}];
    const touchesEnd = [{target, identifier: 1, clientX: 0, clientY: 60}];

    simulate.touchstart(map.getCanvas(), {touches: touchesStart, targetTouches: touchesStart});
    t.equal(touchstart.callCount, 1);
    t.deepEqual(touchstart.getCall(0).args[0].point, {x: 0, y: 50});
    t.equal(touchmove.callCount, 0);
    t.equal(touchend.callCount, 0);

    simulate.touchmove(map.getCanvas(), {touches: touchesMove, targetTouches: touchesMove});
    t.equal(touchstart.callCount, 1);
    t.equal(touchmove.callCount, 1);
    t.deepEqual(touchmove.getCall(0).args[0].point, {x: 0, y: 60});
    t.equal(touchend.callCount, 0);

    simulate.touchend(map.getCanvas(), {touches: [], targetTouches: [], changedTouches: touchesEnd});
    t.equal(touchstart.callCount, 1);
    t.equal(touchmove.callCount, 1);
    t.equal(touchend.callCount, 1);
    t.deepEqual(touchend.getCall(0).args[0].point, {x: 0, y: 60});

    map._renderTaskQueue.run();
    t.equal(drag.callCount, 1);

    map.remove();
    t.end();
});

test('MapEvent handler fires mousemove even while scroll handler is active', (t) => {
    const map = createMap(t);
    map.scrollZoom.enable();
    map.dragPan.enable();

    const wheel = t.spy();
    const mousemove = t.spy();
    const zoom = t.spy();

    map.on('wheel', wheel);
    map.on('mousemove', mousemove);
    map.on('zoomstart', zoom);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    t.equal(wheel.callCount, 1);

    simulate.mousemove(map.getCanvas(), {buttons: 0, clientX: 10, clientY: 10});
    t.equal(mousemove.callCount, 1);
    t.deepEqual(mousemove.getCall(0).args[0].point, {x: 10, y: 10});

    map._renderTaskQueue.run();
    t.equal(zoom.callCount, 1);

    t.end();
});
