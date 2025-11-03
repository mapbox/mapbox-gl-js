import {createWorker} from './web_worker';

export const PRELOAD_POOL_ID = 'mapboxgl_preloaded_worker_pool';

/**
 * Constructs a worker pool.
 * @private
 */
export default class WorkerPool {
    static workerCount: number;

    active: Partial<Record<number | string, boolean>>;
    workers: Array<Worker>;
    name?: string;
    constructor(name?: string) {
        this.active = {};
        this.name = name;
    }

    acquire(mapId: number | string, count = WorkerPool.workerCount): Array<Worker> {
        if (!this.workers) {
            // Lazily look up the value of mapboxgl.workerCount so that
            // client code has had a chance to set it.
            this.workers = [];
            while (this.workers.length < count) {
                const w = createWorker(`${this.name || ''}WorkerPool: ${mapId}-${this.workers.length}`);
                this.workers.push(w);
            }
        }

        this.active[mapId] = true;
        return this.workers.slice();
    }

    release(mapId: number | string) {
        delete this.active[mapId];
        if (this.workers && this.numActive() === 0) {
            this.workers.forEach((w) => {
                w.terminate();
            });
            this.workers = null;
        }
    }

    isPreloaded(): boolean {
        return !!this.active[PRELOAD_POOL_ID];
    }

    numActive(): number {
        return Object.keys(this.active).length;
    }
}

// extensive benchmarking showed 2 to be the best default for both desktop and mobile devices;
// we can't rely on hardwareConcurrency because of wild inconsistency of reported numbers between browsers
WorkerPool.workerCount = 2;
