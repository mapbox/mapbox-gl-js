import {test} from '../../../util/test.js';
import browser from '../../../../src/util/browser.js';
import window from '../../../../src/util/window.js';
import Map from '../../../../src/ui/map.js';
import * as DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';

function createMap(t) {
    t.stub(Map.prototype, '_detectMissingCSS');
    return new Map({container: DOM.create('div', '', window.document.body), useWebGL2: false, testMode: true});
}

test('Map#isZooming returns false by default', (t) => {
    const map = createMap(t);
    t.equal(map.isZooming(), false);
    map.remove();
    t.end();
});

test('Map#isZooming returns true during a camera zoom animation', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        t.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isZooming(), false);
        map.remove();
        t.end();
    });

    map.zoomTo(5, {duration: 0});
});

test('Map#isZooming returns true when scroll zooming', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        t.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isZooming(), false);
        map.remove();
        t.end();
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    setTimeout(() => {
        map._renderTaskQueue.run();
    }, 400);
});

test('Map#isZooming returns true when double-click zooming', (t) => {
    const map = createMap(t);

    map.on('zoomstart', () => {
        t.equal(map.isZooming(), true);
    });

    map.on('zoomend', () => {
        t.equal(map.isZooming(), false);
        map.remove();
        t.end();
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    now += 500;
    map._renderTaskQueue.run();
});

test('Map#isZooming returns true in globe view', (t) => {
    const map = createMap(t);
    map.zoomTo(10, {duration: 0});
    map.setProjection('globe');

    map.on('zoomstart', () => {
        t.equal(map.isZooming(), true);
    });

    let finalCall = false;

    map.on('zoomend', () => {
        t.equal(map.isZooming(), false);

        if (finalCall) {
            map.remove();
            t.end();
        }
    });

    let now = 0;
    t.stub(browser, 'now').callsFake(() => now);

    // Zoom over the transition range
    map.zoomTo(2, {duration: 0});

    // Double click
    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    now += 500;
    map._renderTaskQueue.run();

    // Scroll wheel
    finalCall = true;
    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    setTimeout(() => {
        map._renderTaskQueue.run();
    }, 400);
});
