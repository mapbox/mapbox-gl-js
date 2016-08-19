'use strict';

var test = require('tap').test;
var proxyquire = require('proxyquire');
var WorkerPool = require('../../../js/util/worker_pool');

test('WorkerPool', function (t) {
    t.test('.WORKER_COUNT', function (t) {
        var WorkerPool = proxyquire('../../../js/util/worker_pool', {
            './browser': { hardwareConcurrency: 15 }
        });
        t.equal(WorkerPool.WORKER_COUNT, 14);

        WorkerPool.WORKER_COUNT = 4;
        t.end();
    });

    t.test('#acquire', function (t) {
        // make sure we're actually creating some workers
        t.ok(WorkerPool.WORKER_COUNT > 0);

        var pool = new WorkerPool();

        t.notOk(pool.workers);
        var workers1 = pool.acquire('map-1');
        var workers2 = pool.acquire('map-2');
        t.equal(workers1.length, WorkerPool.WORKER_COUNT);
        t.equal(workers2.length, WorkerPool.WORKER_COUNT);

        // check that the two different dispatchers' workers arrays correspond
        workers1.forEach(function (w, i) { t.equal(w, workers2[i]); });
        t.end();
    });

    t.test('#release', function (t) {
        var pool = new WorkerPool();
        pool.acquire('map-1');
        var workers = pool.acquire('map-2');
        var terminated = 0;
        workers.forEach(function (w) {
            w.terminate = function () { terminated += 1; };
        });

        pool.release('map-2');
        t.comment('keeps workers if a dispatcher is still active');
        t.equal(terminated, 0);
        t.ok(pool.workers.length > 0);

        t.comment('terminates workers if no dispatchers are active');
        pool.release('map-1');
        t.equal(terminated, WorkerPool.WORKER_COUNT);
        t.notOk(pool.workers);

        t.end();
    });

    t.end();
});
