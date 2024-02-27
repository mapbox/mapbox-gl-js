import {test, expect, vi, createMap} from "../../../util/vitest.js";
import browser from '../../../../src/util/browser.js';
import simulate from '../../../util/simulate_interaction.js';

test('Map#isZooming returns false by default', () => {
    const map = createMap();
    expect(map.isZooming()).toEqual(false);
    map.remove();
});

test('Map#isZooming returns true during a camera zoom animation', () => {
    const map = createMap({
        interactive: true
    });

    map.on('zoomstart', () => {
        expect(map.isZooming()).toEqual(true);
    });

    map.on('zoomend', () => {
        expect(map.isZooming()).toEqual(false);
        map.remove();
    });

    map.zoomTo(5, {duration: 0});
});

test('Map#isZooming returns true when scroll zooming', async () => {
    const map = createMap({
        interactive: true
    });

    await new Promise(resolve => {
        map.on('zoomstart', () => {
            expect(map.isZooming()).toEqual(true);
        });

        map.on('zoomend', () => {
            expect(map.isZooming()).toEqual(false);
            map.remove();
            resolve();
        });

        let now = 0;
        vi.spyOn(browser, 'now').mockImplementation(() => now);

        simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
        map._renderTaskQueue.run();

        now += 400;
        setTimeout(() => {
            map._renderTaskQueue.run();
        }, 400);
    });
});

test('Map#isZooming returns true when double-click zooming', () => {
    const map = createMap({
        interactive: true
    });

    map.on('zoomstart', () => {
        expect(map.isZooming()).toEqual(true);
    });

    map.on('zoomend', () => {
        expect(map.isZooming()).toEqual(false);
        map.remove();
    });

    let now = 0;
    vi.spyOn(browser, 'now').mockImplementation(() => now);

    simulate.dblclick(map.getCanvas());
    map._renderTaskQueue.run();

    now += 500;
    map._renderTaskQueue.run();
});

test('Map#isZooming returns true in globe view', () => {
    const map = createMap({
        interactive: true
    });
    map.zoomTo(10, {duration: 0});
    map.setProjection('globe');

    map.on('zoomstart', () => {
        expect(map.isZooming()).toEqual(true);
    });

    let finalCall = false;

    map.on('zoomend', () => {
        expect(map.isZooming()).toEqual(false);

        if (finalCall) {
            map.remove();
        }
    });

    let now = 0;
    vi.spyOn(browser, 'now').mockImplementation(() => now);

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
