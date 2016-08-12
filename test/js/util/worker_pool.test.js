'use strict';

var test = require('tap').test;
var WorkerPool = require('../../../js/util/worker_pool');

test('WorkerPool', function (t) {
    t.test('#acquire', function (t) {
        var pool = new WorkerPool();

        t.equal(pool.workers.length, 0);
        var workers1 = pool.acquire('map-1', 4);
        t.equal(workers1.length, 4);

        var workers2 = pool.acquire('map-2', 8);
        t.equal(workers2.length, 8);
        t.equal(pool.workers.length, 8);

        // check that the two different dispatchers' workers arrays correspond
        workers1.forEach(function (w, i) { t.equal(w, workers2[i]); });
        t.end();
    });

    t.test('#release', function (t) {
        var pool = new WorkerPool();
        pool.acquire('map-1', 1);
        var workers = pool.acquire('map-2', 4);
        var terminated = 0;
        workers.forEach(function (w) {
            w.terminate = function () { terminated += 1; };
        });

        pool.release('map-2');
        t.comment('keeps workers if a dispatcher is still active');
        t.equal(terminated, 0);
        t.equal(pool.workers.length, 4);

        t.comment('terminates workers if no dispatchers are active');
        pool.release('map-1');
        t.equal(terminated, 4);
        t.equal(pool.workers.length, 0);

        t.end();
    });

    t.end();
});
