import {test} from '../../../util/test.js';
import window from '../../../../src/util/window.js';
import Map from '../../../../src/ui/map.js';
import * as DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';
import browser from '../../../../src/util/browser.js';

function createMap(t, proj = 'mercator') {
    t.stub(Map.prototype, '_detectMissingCSS');
    const map = new Map({container: DOM.create('div', '', window.document.body), testMode: true});
    map.setProjection(proj);
    return map;
}

test('Map#isRotating returns false by default', (t) => {
    const map = createMap(t);
    t.equal(map.isRotating(), false);
    map.remove();
    t.end();
});

test('#MapisRotating with various projections', (t) => {
    const projections = ['globe', 'mercator'];
    for (const proj of projections) {
        test('Map#isRotating returns true during a camera rotate animation', (t) => {
            const map = createMap(t, proj);

            map.on('rotatestart', () => {
                t.equal(map.isRotating(), true);
            });

            map.on('rotateend', () => {
                t.equal(map.isRotating(), false);
                map.remove();
                t.end();
            });

            map.rotateTo(5, {duration: 0});
        });
    }
    t.end();
});

test('Map#isRotating returns true when drag rotating', (t) => {
    const map = createMap(t);

    // Prevent inertial rotation.
    t.stub(browser, 'now').returns(0);

    map.on('rotatestart', () => {
        t.equal(map.isRotating(), true);
    });

    map.on('rotateend', () => {
        t.equal(map.isRotating(), false);
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
