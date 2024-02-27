import {describe, test, expect, vi} from "../../util/vitest.js";
import Dispatcher from '../../../src/util/dispatcher.js';
import WebWorker from '../../../src/util/web_worker.js';
import WorkerPool from '../../../src/util/worker_pool.js';

describe('Dispatcher', () => {
    test('requests and releases workers from pool', () => {
        const workers = [new WebWorker(), new WebWorker()];

        const releaseCalled = [];
        const workerPool = {
            acquire () {
                return workers;
            },
            release (id) {
                releaseCalled.push(id);
            }
        };

        const dispatcher = new Dispatcher(workerPool, {});
        expect(dispatcher.actors.map((actor) => { return actor.target; })).toStrictEqual(workers);
        dispatcher.remove();
        expect(dispatcher.actors.length).toEqual(0);
        expect(releaseCalled).toStrictEqual([dispatcher.id]);
    });

    test('creates Actors with unique map id', () => {
        const ids = [];
        function Actor (target, parent, mapId) { ids.push(mapId); }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => {});
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 1);

        const workerPool = new WorkerPool();
        const dispatchers = [new Dispatcher(workerPool, {}), new Dispatcher(workerPool, {})];
        expect(ids).toStrictEqual(dispatchers.map((d) => { return d.id; }));
    });

    test('#remove destroys actors', () => {
        const actorsRemoved = [];
        function Actor() {
            this.remove = function() { actorsRemoved.push(this); };
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => {});
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 4);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});
        dispatcher.remove();
        expect(actorsRemoved.length).toEqual(4);
    });
});

