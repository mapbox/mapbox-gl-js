import WorkerClass from './worker_class';

export function createWorker(): Worker {
    const workerUrl = WorkerClass.workerUrl ?
        WorkerClass.workerUrl :
        // it's safe to use import.meta.url here because this file is only used in the ESM bundle
        // eslint-disable-next-line no-restricted-syntax
        new URL('worker.js', import.meta.url).href;

    const blob = new Blob([`import '${workerUrl}';`], {type: 'application/javascript'});
    return new Worker(URL.createObjectURL(blob), {type: 'module'});
}
