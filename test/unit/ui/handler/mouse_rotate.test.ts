// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect, vi, createMap as globalCreateMap} from '../../../util/vitest';
import simulate from '../../../util/simulate_interaction';
import browser from '../../../../src/util/browser';

function createMap(options) {
    return globalCreateMap({
        interactive: true,
        ...options
    });
}

test('MouseRotateHandler#isActive', () => {
    const map = createMap();
    const mouseRotate = map.handlers._handlersById.mouseRotate;

    // Prevent inertial rotation.
    vi.spyOn(browser, 'now').mockImplementation(() => 0);
    expect(mouseRotate.isActive()).toEqual(false);

    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();
    expect(mouseRotate.isActive()).toEqual(false);

    simulate.mousemove(window.document, {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(mouseRotate.isActive()).toEqual(true);

    simulate.mouseup(window.document,   {buttons: 0, button: 2});
    map._renderTaskQueue.run();
    expect(mouseRotate.isActive()).toEqual(false);

    map.remove();
});

test('MouseRotateHandler#isActive #4622 regression test', () => {
    const map = createMap();
    const mouseRotate = map.handlers._handlersById.mouseRotate;

    // Prevent inertial rotation.
    simulate.mousedown(map.getCanvas(), {buttons: 2, button: 2});
    map._renderTaskQueue.run();
    expect(mouseRotate.isActive()).toEqual(false);

    simulate.mousemove(window.document, {buttons: 2, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(mouseRotate.isActive()).toEqual(true);

    // Some browsers don't fire mouseup when it happens outside the window.
    // Make the handler in active when it encounters a mousemove without the button pressed.

    simulate.mousemove(window.document, {buttons: 0, clientX: 10, clientY: 10});
    map._renderTaskQueue.run();
    expect(mouseRotate.isActive()).toEqual(false);

    map.remove();
});

test('MouseRotateHandler#pitchRotateKey', () => {
    const map = createMap({pitchRotateKey: 'Meta'});
    const mouseRotate = map.handlers._handlersById.mouseRotate;

    // Prevent inertial rotation.
    vi.spyOn(browser, 'now').mockImplementation(() => 0);
    expect(mouseRotate._lastPoint).toBeUndefined();

    simulate.mousedown(map.getCanvas(), {button: 0, ctrlKey: true});
    map._renderTaskQueue.run();
    expect(mouseRotate._lastPoint).toBeUndefined();

    simulate.mousedown(map.getCanvas(), {button: 0, metaKey: true});
    map._renderTaskQueue.run();
    expect(mouseRotate._lastPoint).toBeDefined();

    map.remove();
});
