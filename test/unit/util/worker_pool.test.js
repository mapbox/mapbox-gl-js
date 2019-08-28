import {test} from '../../util/test';
import WorkerPool from '../../../src/util/worker_pool';

test('WorkerPool', (t) => {
    t.test('#acquire', (t) => {
        t.stub(WorkerPool, 'workerCount').value(4);

        const pool = new WorkerPool();

        t.notOk(pool.workers);
        const workers1 = pool.acquire('map-1');
        const workers2 = pool.acquire('map-2');
        t.equal(workers1.length, 4);
        t.equal(workers2.length, 4);

        // check that the two different dispatchers' workers arrays correspond
        workers1.forEach((w, i) => { t.equal(w, workers2[i]); });
        t.end();
    });

    t.test('#release', (t) => {
        let workersTerminated = 0;
        t.stub(WorkerPool, 'workerCount').value(4);

        const pool = new WorkerPool();
        pool.acquire('map-1');
        const workers = pool.acquire('map-2');
        workers.forEach((w) => {
            w.terminate = function () { workersTerminated += 1; };
        });

        pool.release('map-2');
        t.comment('keeps workers if a dispatcher is still active');
        t.equal(workersTerminated, 0);
        t.ok(pool.workers.length > 0);

        t.comment('terminates workers if no dispatchers are active');
        pool.release('map-1');
        t.equal(workersTerminated, 4);
        t.notOk(pool.workers);

        t.end();
    });

    t.end();
});
