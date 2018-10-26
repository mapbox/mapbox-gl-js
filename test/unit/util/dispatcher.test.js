import { test } from 'mapbox-gl-js-test';
import Dispatcher from '../../../src/util/dispatcher';
import WebWorker from '../../../src/util/web_worker';
import WorkerPool from '../../../src/util/worker_pool';

test('Dispatcher', (t) => {
    t.test('requests and releases workers from pool', (t) => {
        const workers = [new WebWorker(), new WebWorker()];

        const releaseCalled = [];
        const workerPool = {
            acquire: function () {
                return workers;
            },
            release: function (id) {
                releaseCalled.push(id);
            }
        };

        const dispatcher = new Dispatcher(workerPool, {});
        t.same(dispatcher.actors.map((actor) => { return actor.target; }), workers);
        dispatcher.remove();
        t.equal(dispatcher.actors.length, 0, 'actors discarded');
        t.same(releaseCalled, [dispatcher.id]);

        t.end();
    });

    t.test('creates Actors with unique map id', (t) => {
        const ids = [];
        function Actor (target, parent, mapId) { ids.push(mapId); }
        t.stub(Dispatcher, 'Actor').callsFake(Actor);
        t.stub(WorkerPool, 'workerCount').value(1);

        const workerPool = new WorkerPool();
        const dispatchers = [new Dispatcher(workerPool, {}), new Dispatcher(workerPool, {})];
        t.same(ids, dispatchers.map((d) => { return d.id; }));

        t.end();
    });

    t.test('#remove destroys actors', (t) => {
        const actorsRemoved = [];
        function Actor() {
            this.remove = function() { actorsRemoved.push(this); };
        }
        t.stub(Dispatcher, 'Actor').callsFake(Actor);
        t.stub(WorkerPool, 'workerCount').value(4);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});
        dispatcher.remove();
        t.equal(actorsRemoved.length, 4);
        t.end();
    });

    t.end();
});

