import type {Class} from '../types/class';

type WorkerState = {
    workerUrl: string;
    workerClass: Class<Worker> | null;
    workerFactory: (() => Worker) | null;
    workerParams?: WorkerOptions; // Internal, test-only: extra options passed to `new Worker()`
};

const WorkerClass: WorkerState = {
    workerUrl: '',
    workerClass: null,
    workerFactory: null,
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

/**
 * Sets a constructor used to create the WebWorker. Must be set once, before the
 * first `new Map(...)`. Counterpart to `mapboxgl.workerClass` on the default
 * bundle, and takes precedence over {@link setWorkerUrl}.
 *
 * Bundlers that only rewrite the `new Worker(new URL(...), ...)` pattern in the
 * application's own sources — Angular's esbuild-based builder, for example —
 * never see the equivalent expression inside this package and therefore emit no
 * worker chunk for it. Passing a constructor lets the application spell that
 * pattern out itself and hand the resulting worker back.
 *
 * @param {Class<Worker>} klass A constructor returning a WebWorker running the GL JS worker bundle.
 */
export function setWorkerClass(klass: Class<Worker> | null) {
    WorkerClass.workerClass = klass;
}

/**
 * Sets a function used to create the WebWorker. Must be set once, before the
 * first `new Map(...)`. Takes precedence over {@link setWorkerClass} and
 * {@link setWorkerUrl}.
 *
 * Serves the same purpose as {@link setWorkerClass}, in a shape that type-checks:
 * an application that has to construct the worker itself can only return an
 * instance, and a constructor returning an unrelated object cannot be expressed
 * in TypeScript, so every `workerClass` caller ends up asserting the type.
 *
 * @param {Function} create A function returning a WebWorker running the GL JS worker bundle.
 */
export function setWorkerFactory(create: (() => Worker) | null) {
    WorkerClass.workerFactory = create;
}

export default WorkerClass;
