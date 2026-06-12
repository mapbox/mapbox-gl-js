import type {Class} from '../types/class';

type WorkerState = {
    workerUrl: string;
    workerClass: Class<Worker> | null;
    workerParams?: WorkerOptions; // Internal, test-only: extra options passed to `new Worker()`
};

const WorkerClass: WorkerState = {
    workerUrl: '',
    workerClass: null,
    workerParams: undefined,
};

/**
 * Sets the URL from which the WebWorker bundle is loaded. Must be set once,
 * before the first `new Map(...)`. Used by both the UMD and ESM bundles to
 * override the default worker location — for example to load the worker from a
 * same-origin trampoline when GL JS is served cross-origin.
 *
 * @param {string} url A URL hosting the GL JS WebWorker bundle.
 */
export function setWorkerUrl(url: string) {
    WorkerClass.workerUrl = url;
}

export default WorkerClass;
