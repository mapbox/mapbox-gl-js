'use strict';

var test = require('tap').test;
var proxyquire = require('proxyquire');
var Dispatcher = require('../../../js/util/dispatcher');
var WebWorker = require('../../../js/util/web_worker');
var WorkerPool = require('../../../js/util/worker_pool');

test('Dispatcher', function (t) {
    t.test('requests and releases workers from pool', function (t) {
        var dispatcher;
        var workers = [new WebWorker(), new WebWorker()];

        var releaseCalled = [];
        var workerPool = {
            acquire: function (id, count) {
                t.equal(count, 2);
                return workers;
            },
            release: function (id) {
                releaseCalled.push(id);
            }
        };

        dispatcher = new Dispatcher(workerPool, 2, {});
        t.same(dispatcher.actors.map(function (actor) { return actor.target; }), workers);
        dispatcher.remove();
        t.equal(dispatcher.actors.length, 0, 'actors discarded');
        t.same(releaseCalled, [dispatcher.id]);

        t.end();
    });

    test('creates Actors with unique map id', function (t) {
        var Dispatcher = proxyquire('../../../js/util/dispatcher', { './actor': Actor });

        var ids = [];
        function Actor (target, parent, mapId) { ids.push(mapId); }

        var workerPool = new WorkerPool();
        var dispatchers = [new Dispatcher(workerPool, 1, {}), new Dispatcher(workerPool, 1, {})];
        t.same(ids, dispatchers.map(function (d) { return d.id; }));

        t.end();
    });

    t.end();
});

