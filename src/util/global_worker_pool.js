// @flow

import WorkerPool, {PRELOAD_POOL_ID} from './worker_pool';

let globalWorkerPool;

/**
 * Creates (if necessary) and returns the single, global WorkerPool instance
 * to be shared across each Map
 * @private
 */
export default function getGlobalWorkerPool () {
    if (!globalWorkerPool) {
        globalWorkerPool = new WorkerPool();
    }
    return globalWorkerPool;
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
