import {test} from '../../../util/test';
import browser from '../../../../src/util/browser';
import window from '../../../../src/util/window';
import Map from '../../../../src/ui/map';
import DOM from '../../../../src/util/dom';
import simulate from '../../../util/simulate_interaction';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({container: DOM.create('div', '', window.document.body)});
}

test('Map#isMoving returns false by default', (t) => {
    const map = createMap(t);
    t.equal(map.isMoving(), false);
    map.remove();
    t.end();
});

test('Map#isMoving returns true during a camera zoom animation', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    map.zoomTo(5, {duration: 0});
});

test('Map#isMoving returns true when drag panning', (t) => {
    const map = createMap(t);

    map.on('dragstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('dragend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when drag rotating', (t) => {
    const map = createMap(t);

    // Prevent inertial rotation.
    t.stub(browser, 'now').returns(0);

    map.on('rotatestart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('rotateend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when scroll zooming', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    const browserNow = t.stub(browser, 'now');
    let now = 0;
    browserNow.callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when drag panning and scroll zooming interleave', (t) => {
    const map = createMap(t);

    map.on('dragstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomstart', () => {
        t.equal(map.isMoving(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isMoving(), true);
        simulate.mouseup(map.getCanvas());
        map._renderTaskQueue.run();
    });

    map.on('dragend', () => {
        t.equal(map.isMoving(), false);
        map.remove();
        t.end();
    });

    // The following should trigger the above events, where a zoomstart/zoomend
    // pair is nested within a dragstart/dragend pair.

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    const browserNow = t.stub(browser, 'now');
    let now = 0;
    browserNow.callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    map._renderTaskQueue.run();
});
