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


export function preloadWorkerPool() {
    const workerPool = getGlobalWorkerPool();
    workerPool.acquire(PRELOAD_POOL_ID);
}

