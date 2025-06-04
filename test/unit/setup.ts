// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* global globalThis */

window.devicePixelRatio = 1;

// Load Error Handling
// https://vitejs.dev/guide/build#load-error-handling
window.addEventListener('vite:preloadError', (event) => {
    console.log('vite:preloadError', event);
    window.location.reload();
});

import WorkerClass from '../../src/util/worker_class';

if (!globalThis.defined) {
    WorkerClass.workerParams = {
        type: 'module'
    };

    WorkerClass.workerUrl = '/src/source/worker.ts';

    globalThis.defined = true;
}
