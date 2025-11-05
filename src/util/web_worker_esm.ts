import WorkerClass from './worker_class';

export function createWorker(): Worker {
    const workerUrl = WorkerClass.workerUrl ?
        WorkerClass.workerUrl :
        new URL('worker.js', import.meta.url).href;

    const blob = new Blob([`import '${workerUrl}';`], {type: 'application/javascript'});
    return new Worker(URL.createObjectURL(blob), {type: 'module'});
}
