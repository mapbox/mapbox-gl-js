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

test('MousePitchHandler#pitchRotateKey', () => {
    const map = createMap({pitchRotateKey: 'Meta'});
    const mousePitch = map.handlers._handlersById.mousePitch;

    // Prevent inertial rotation.
    vi.spyOn(browser, 'now').mockImplementation(() => 0);
    expect(mousePitch._lastPoint).toBeUndefined();

    simulate.mousedown(map.getCanvas(), {button: 0, ctrlKey: true});
    map._renderTaskQueue.run();
    expect(mousePitch._lastPoint).toBeUndefined();

    simulate.mousedown(map.getCanvas(), {button: 0, metaKey: true});
    map._renderTaskQueue.run();
    expect(mousePitch._lastPoint).toBeDefined();

    map.remove();
});
