import {describe, test, expect, vi} from "../../../util/vitest.js";
import browser from '../../../../src/util/browser.js';
import {Map} from '../../../../src/ui/map.js';
import * as DOM from '../../../../src/util/dom.js';
import simulate from '../../../util/simulate_interaction.js';

function createMap(t, proj = 'mercator') {
    vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    const map = new Map({container: DOM.create('div', '', window.document.body), testMode: true});
    map.setProjection(proj);
    return map;
}

// MouseEvent.buttons
const buttons = 1;

test('Map#isMoving returns false by default', () => {
    const map = createMap();
    expect(map.isMoving()).toEqual(false);
    map.remove();
});

describe('Map#isMoving with various projections', () => {
    const projections = ['globe', 'mercator'];
    for (const proj of projections) {
        test('Map#isMoving returns true during a camera zoom animation', () => {
            const map = createMap(proj);

            map.on('zoomstart', () => {
                expect(map.isMoving()).toEqual(true);
            });

            map.on('zoomend', () => {
                expect(map.isMoving()).toEqual(false);
                map.remove();
            });

            map.zoomTo(5, {duration: 0});
        });
    }
});

test('Map#isMoving returns true when drag panning', () => {
    const map = createMap();

    map.on('movestart', () => {
        expect(map.isMoving()).toEqual(true);
    });
    map.on('dragstart', () => {
        expect(map.isMoving()).toEqual(true);
    });

    map.on('dragend', () => {
        expect(map.isMoving()).toEqual(false);
    });
    map.on('moveend', () => {
        expect(map.isMoving()).toEqual(false);
        map.remove();
    });

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas());
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when drag rotating', () => {
    const map = createMap();

    // Prevent inertial rotation.
    vi.spyOn(browser, 'now').mockImplementation(() => 0);

    map.on('movestart', () => {
        expect(map.isMoving()).toEqual(true);
    });
    map.on('rotatestart', () => {
        expect(map.isMoving()).toEqual(true);
    });

    map.on('rotateend', () => {
        expect(map.isMoving()).toEqual(false);
    });
    map.on('moveend', () => {
        expect(map.isMoving()).toEqual(false);
        map.remove();
    });

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    simulate.mouseup(map.getCanvas(),   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
});

test('Map#isMoving returns true when scroll zooming', () => {
    const map = createMap();

    map.on('zoomstart', () => {
        expect(map.isMoving()).toEqual(true);
    });

    map.on('zoomend', () => {
        expect(map.isMoving()).toEqual(false);
        map.remove();
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

test('Map#isMoving returns true when drag panning and scroll zooming interleave', () => {
    const map = createMap();

    map.on('dragstart', () => {
        expect(map.isMoving()).toEqual(true);
    });

    map.on('zoomstart', () => {
        expect(map.isMoving()).toEqual(true);
    });

    map.on('zoomend', () => {
        expect(map.isMoving()).toEqual(true);
        simulate.mouseup(map.getCanvas());
        setTimeout(() => {
            map._renderTaskQueue.run();
        });
    });

    map.on('dragend', () => {
        expect(map.isMoving()).toEqual(false);
        map.remove();
    });

    // The following should trigger the above events, where a zoomstart/zoomend
    // pair is nested within a dragstart/dragend pair.

    simulate.mousedown(map.getCanvas());
    map._renderTaskQueue.run();

    simulate.mousemove(map.getCanvas(), {buttons, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();

    let now = 0;
    vi.spyOn(browser, 'now').mockImplementation(() => now);

    simulate.wheel(map.getCanvas(), {type: 'wheel', deltaY: -simulate.magicWheelZoomDelta});
    map._renderTaskQueue.run();

    now += 400;
    setTimeout(() => {
        map._renderTaskQueue.run();
    }, 400);
});
