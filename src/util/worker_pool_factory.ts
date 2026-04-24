import WorkerPool, {PRELOAD_POOL_ID} from './worker_pool';
import Dispatcher from './dispatcher';

let globalDispatcher: Dispatcher | null = null;
let globalWorkerPool: WorkerPool | null | undefined;
let imageRasterizerWorkerPool: WorkerPool | null | undefined;

/**
 * Creates (if necessary) and returns the single, global WorkerPool instance
 * to be shared across each Map
 * @private
 */
export function getGlobalWorkerPool(): WorkerPool {
    if (!globalWorkerPool) {
        globalWorkerPool = new WorkerPool();
    }
    return globalWorkerPool;
}

// We have a separate worker pool for image rasterization because:
//   - We need to share cache between tile workers
//   - To unblock tiles worker pool when image rasterization is in progress
export function getImageRasterizerWorkerPool(): WorkerPool {
    if (!imageRasterizerWorkerPool) {
        imageRasterizerWorkerPool = new WorkerPool('ImageRasterizer');
    }

    return imageRasterizerWorkerPool;
}

export function prewarm() {
    getGlobalWorkerPool().acquire(PRELOAD_POOL_ID);
    getImageRasterizerWorkerPool().acquire(PRELOAD_POOL_ID);
}

export function getGlobalDispatcher(): Dispatcher {
    if (!globalDispatcher) {
        globalDispatcher = new Dispatcher(getGlobalWorkerPool(), {});
    }
    return globalDispatcher;
}

export function clearPrewarmedResources() {
    const dispatcher = globalDispatcher;
    if (dispatcher) {
        dispatcher.remove();
        globalDispatcher = null;
    }

    const pool = globalWorkerPool;
    if (pool) {
        // Remove the pool only if all maps that referenced the preloaded global worker pool have been removed.
        if (pool.isPreloaded() && pool.numActive() === 1) {
            pool.release(PRELOAD_POOL_ID);
            globalWorkerPool = null;
        } else {
            console.warn('Could not clear WebWorkers since there are active Map instances that still reference it. The pre-warmed WebWorker pool can only be cleared when all map instances have been removed with map.remove()');
        }
    }

    const rasterizerPool = imageRasterizerWorkerPool;
    if (rasterizerPool && rasterizerPool.isPreloaded() && rasterizerPool.numActive() === 1) {
        rasterizerPool.release(PRELOAD_POOL_ID);
        imageRasterizerWorkerPool = null;
    }
}
