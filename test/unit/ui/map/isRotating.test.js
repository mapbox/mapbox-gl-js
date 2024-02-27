import {describe, test, expect, vi, createMap} from "../../../util/vitest.js";
import simulate from '../../../util/simulate_interaction.js';
import browser from '../../../../src/util/browser.js';

test('Map#isRotating returns false by default', () => {
    const map = createMap();
    expect(map.isRotating()).toEqual(false);
    map.remove();
});

describe('#MapisRotating with various projections', () => {
    const projections = ['globe', 'mercator'];
    for (const proj of projections) {
        test('Map#isRotating returns true during a camera rotate animation', () => {
            const map = createMap(proj);

            map.on('rotatestart', () => {
                expect(map.isRotating()).toEqual(true);
            });

            map.on('rotateend', () => {
                expect(map.isRotating()).toEqual(false);
                map.remove();
            });

            map.rotateTo(5, {duration: 0});
        });
    }
});

test('Map#isRotating returns true when drag rotating', () => {
    const map = createMap({
        interactive: true
    });

    // Prevent inertial rotation.
    vi.spyOn(browser, 'now').mockImplementation(() => 0);

    map.on('rotatestart', () => {
        expect(map.isRotating()).toEqual(true);
    });

    map.on('rotateend', () => {
        expect(map.isRotating()).toEqual(false);
        map.remove();
    });

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
});
