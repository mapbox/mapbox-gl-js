// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {expect} from '../../../util/vitest';
import TaskQueue from '../../../../src/util/task_queue';
import Transform from '../../../../src/geo/transform';
import browser from '../../../../src/util/browser';
import Camera from '../../../../src/ui/camera';

export async function assertTransitionTime(camera, min, max, action) {
    let startTime;
    await new Promise(resolve => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        camera
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            .on('movestart', () => { startTime = browser.now(); })
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            .on('moveend', () => {
                const endTime = browser.now();
                const timeDiff = endTime - startTime;
                expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                resolve();
            });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        action();
    });
}

export function attachSimulateFrame(camera) {
    const queue = new TaskQueue();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    camera._requestRenderFrame = (cb) => queue.add(cb);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
    camera._cancelRenderFrame = (id) => queue.remove(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    camera.simulateFrame = () => queue.run();
    return camera;
}

export function createCamera(options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    options = options || {};

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const transform = new Transform(0, 20, 0, 85, options.renderWorldCopies, options.projection);
    transform.resize(512, 512);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument
    const camera = attachSimulateFrame(new Camera(transform, options))
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        .jumpTo(options);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    camera._update = () => {};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    camera._preloadTiles = () => {};

    return camera;
}
