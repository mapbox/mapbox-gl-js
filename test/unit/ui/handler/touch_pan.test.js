import {test, expect, vi, createMap as globalCreateMap} from "../../../util/vitest.js";
import simulate, {constructTouch} from '../../../util/simulate_interaction.js';

function createMapWithCooperativeGestures() {
    return globalCreateMap({
        cooperativeGestures: true,
        interactive: true
    });
}

test('If cooperativeGestures option is set to true, a `.mapboxgl-touch-pan-blocker` element is added to map', () => {
    const map = createMapWithCooperativeGestures();

    expect(map.getContainer().querySelectorAll('.mapboxgl-touch-pan-blocker').length).toEqual(1);
});

test('If cooperativeGestures option is set to true, touch pan is prevented when one finger is used to pan', () => {
    const map = createMapWithCooperativeGestures();
    const target = map.getCanvas();

    const moveSpy = vi.fn();
    map.on('move', moveSpy);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -50})]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -40})]});
    map._renderTaskQueue.run();

    expect(moveSpy).not.toHaveBeenCalled();
});

test('If cooperativeGestures option is set to true, touch pan is triggered when two fingers are used to pan', () => {
    const map = createMapWithCooperativeGestures();
    const target = map.getCanvas();

    const moveSpy = vi.fn();
    map.on('move', moveSpy);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -40}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: -30})]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -50}), constructTouch(target, {target, identifier: 2, clientX: 0, clientY: -40})]});
    map._renderTaskQueue.run();

    expect(moveSpy).toHaveBeenCalledTimes(1);
});

test('When cooperativeGestures is true and map is in fullscreen, touch pan is not prevented', () => {
    vi.spyOn(window.document, 'fullscreenElement', 'get').mockImplementation(() => true);
    const map = createMapWithCooperativeGestures();
    const target = map.getCanvas();

    const moveSpy = vi.fn();
    map.on('move', moveSpy);

    simulate.touchstart(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -50})]});
    map._renderTaskQueue.run();

    simulate.touchmove(map.getCanvas(), {touches: [constructTouch(target, {target, identifier: 1, clientX: 0, clientY: -40})]});
    map._renderTaskQueue.run();

    expect(moveSpy).toHaveBeenCalledTimes(1);
});

test('Disabling touch pan removes the `.mapboxgl-touch-pan-blocker` element', () => {
    const map = createMapWithCooperativeGestures();

    map.handlers._handlersById.touchPan.disable();

    expect(map.getContainer().querySelectorAll('.mapboxgl-touch-pan-blocker').length).toEqual(0);
});
