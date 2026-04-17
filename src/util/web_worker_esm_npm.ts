import WorkerClass from './worker_class';

// Used by the ESM NPM bundle. Bundlers (webpack, vite) detect the
// `new Worker(new URL(...))` pattern and bundle the worker with all
// its dependencies into a separate chunk. Also works when self-hosted
// same-origin without a bundler.
export function createWorker(): Worker {
    if (WorkerClass.workerUrl) {
        return new Worker(WorkerClass.workerUrl, {type: 'module'});
    }

    // eslint-disable-next-line no-restricted-syntax
    return new Worker(new URL('worker.js', import.meta.url), {type: 'module'});
}
