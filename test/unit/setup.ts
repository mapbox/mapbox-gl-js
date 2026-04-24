window.devicePixelRatio = 1;

import {beforeEach, afterEach} from 'vitest';
import WorkerClass from '../../src/util/worker_class';
import {prewarm} from '../../src/util/worker_pool_factory';
import {markTestBaseline, cleanupTestMaps} from '../util/vitest';

if (!globalThis.defined) {
    WorkerClass.workerParams = {
        type: 'module'
    };

    WorkerClass.workerUrl = '/src/source/worker.ts';

    globalThis.defined = true;
}

// Keep the shared WorkerPool alive across all tests in this iframe. Without
// this, `map.remove()` in `cleanupTestMaps` drives `numActive` to 0 and
// terminates the workers, forcing every test to spin up a fresh pair. Must
// run AFTER `WorkerClass.workerUrl` is set, otherwise workers are created
// with an empty URL and never process messages.
prewarm();

beforeEach(markTestBaseline);
afterEach(cleanupTestMaps);
