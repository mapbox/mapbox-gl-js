import WorkerClass from './worker_class';

// Used by the ESM CDN bundle. Browsers block cross-origin workers, so when
// GL JS is served from a CDN (different origin than the page), we can't pass
// the worker URL directly to `new Worker()`. Instead we create a same-origin
// Blob that imports the cross-origin worker script, bypassing the restriction.
export function createWorker(): Worker {
    const workerUrl = WorkerClass.workerUrl ?
        WorkerClass.workerUrl :
        // eslint-disable-next-line no-restricted-syntax
        new URL('worker.js', import.meta.url).href;

    const blob = new Blob([`import '${workerUrl}';`], {type: 'application/javascript'});
    return new Worker(URL.createObjectURL(blob), {type: 'module'});
}
