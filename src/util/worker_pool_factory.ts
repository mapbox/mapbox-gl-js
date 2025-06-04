import WorkerPool, {PRELOAD_POOL_ID} from './worker_pool';

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
        imageRasterizerWorkerPool = new WorkerPool();
    }

    return imageRasterizerWorkerPool;
}

export function prewarm() {
    const workerPool = getGlobalWorkerPool();
    workerPool.acquire(PRELOAD_POOL_ID);
}

export function clearPrewarmedResources() {
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
}
