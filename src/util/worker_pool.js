// @flow

import assert from 'assert';

import WebWorker from './web_worker';

import type {WorkerInterface} from './web_worker';

/**
 * Constructs a worker pool.
 * @private
 */
class WorkerPool {
    active: {[number]: boolean};
    workers: Array<WorkerInterface>;

    constructor() {
        this.active = {};
    }

    acquire(mapId: number) {
        if (!this.workers) {
            // Lazily look up the value of mapboxgl.workerCount.  This allows
            // client code a chance to set it while circumventing cyclic
            // dependency problems
            const workerCount = require('../').workerCount;
            assert(typeof workerCount === 'number' && workerCount < Infinity);

            this.workers = [];
            while (this.workers.length < workerCount) {
                this.workers.push(new WebWorker());
            }
        }

        this.active[mapId] = true;
        return this.workers.slice();
    }

    release(mapId: number) {
        delete this.active[mapId];
        if (Object.keys(this.active).length === 0) {
            this.workers.forEach((w) => {
                w.terminate();
            });
            this.workers = (null: any);
        }
    }
}

export default WorkerPool;
