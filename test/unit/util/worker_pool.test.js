import {describe, test, expect, vi} from "../../util/vitest.js";
import WorkerPool from '../../../src/util/worker_pool.js';

describe('WorkerPool', () => {
    test('#acquire', () => {
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 4);

        const pool = new WorkerPool();

        expect(pool.workers).toBeFalsy();
        const workers1 = pool.acquire('map-1');
        const workers2 = pool.acquire('map-2');
        expect(workers1.length).toEqual(4);
        expect(workers2.length).toEqual(4);

        // check that the two different dispatchers' workers arrays correspond
        workers1.forEach((w, i) => { expect(w).toEqual(workers2[i]); });
    });

    test('#release', () => {
        let workersTerminated = 0;
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 4);

        const pool = new WorkerPool();
        pool.acquire('map-1');
        const workers = pool.acquire('map-2');
        workers.forEach((w) => {
            w.terminate = function () { workersTerminated += 1; };
        });

        pool.release('map-2');
        // keeps workers if a dispatcher is still active
        expect(workersTerminated).toEqual(0);
        expect(pool.workers.length > 0).toBeTruthy();

        // terminates workers if no dispatchers are active
        pool.release('map-1');
        expect(workersTerminated).toEqual(4);
        expect(pool.workers).toBeFalsy();

        // doesn't throw when terminating multiple times
        expect(() => { pool.release('map-1'); }).not.toThrowError();
    });
});
