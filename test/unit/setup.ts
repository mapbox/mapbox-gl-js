window.devicePixelRatio = 1;

import WorkerClass from '../../src/util/worker_class';

if (!globalThis.defined) {
    WorkerClass.workerParams = {
        type: 'module'
    };

    WorkerClass.workerUrl = '/src/source/worker.ts';

    globalThis.defined = true;
}
