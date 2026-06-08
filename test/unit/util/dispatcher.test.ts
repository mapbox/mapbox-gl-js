// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-misused-promises */
import {describe, test, expect, vi} from '../../util/vitest';
import Dispatcher from '../../../src/util/dispatcher';
import {createWorker} from '../../../src/util/web_worker';
import WorkerPool from '../../../src/util/worker_pool';

describe('Dispatcher', () => {
    test('requests and releases workers from pool', () => {
        const workers = [createWorker(), createWorker()];

        const releaseCalled: Array<any> = [];
        const workerPool = {
            acquire() {
                return workers;
            },
            release(id) {
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
        const ids: Array<any> = [];
        function Actor(target, parent, mapId) { ids.push(mapId); }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => Promise.resolve([]));
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 1);

        const workerPool = new WorkerPool();
        const dispatchers = [new Dispatcher(workerPool, {}), new Dispatcher(workerPool, {})];
        expect(ids).toStrictEqual(dispatchers.map((d) => { return d.id; }));
    });

    test('#remove destroys actors', () => {
        const actorsRemoved: Array<any> = [];
        function Actor() {
            this.remove = function () { actorsRemoved.push(this); };
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(Dispatcher.prototype, 'broadcast').mockImplementation(() => Promise.resolve([]));
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 4);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});
        dispatcher.remove();
        expect(actorsRemoved.length).toEqual(4);
    });

    test('broadcast with keepResult: true resolves with results in actor order', async () => {
        const responses = [{a: 1}, {a: 2}, {a: 3}];
        let i = 0;
        function Actor() {
            const idx = i++;
            this.send = () => Promise.resolve(responses[idx]);
            this.remove = () => {};
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 3);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});

        const result = await dispatcher.broadcast('getWorkerPerformanceMetrics', undefined, {keepResult: true});
        expect(result).toEqual(responses);
    });

});

