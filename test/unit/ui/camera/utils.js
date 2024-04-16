import {expect} from '../../../util/vitest.js';
import TaskQueue from '../../../../src/util/task_queue.js';
import Transform from '../../../../src/geo/transform.js';
import browser from '../../../../src/util/browser.js';
import Camera from '../../../../src/ui/camera.js';

export async function assertTransitionTime(camera, min, max, action) {
    let startTime;
    await new Promise(resolve => {
        camera
            .on('movestart', () => { startTime = browser.now(); })
            .on('moveend', () => {
                const endTime = browser.now();
                const timeDiff = endTime - startTime;
                expect(timeDiff >= min && timeDiff < max).toBeTruthy();
                resolve();
            });
        action();
    });
}

export function attachSimulateFrame(camera) {
    const queue = new TaskQueue();
    camera._requestRenderFrame = (cb) => queue.add(cb);
    camera._cancelRenderFrame = (id) => queue.remove(id);
    camera.simulateFrame = () => queue.run();
    return camera;
}

export function createCamera(options) {
    options = options || {};

    const transform = new Transform(0, 20, 0, 85, options.renderWorldCopies, options.projection);
    transform.resize(512, 512);

    const camera = attachSimulateFrame(new Camera(transform, options))
        .jumpTo(options);

    camera._update = () => {};
    camera._preloadTiles = () => {};

    return camera;
}
