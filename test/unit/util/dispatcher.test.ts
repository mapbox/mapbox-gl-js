// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
        // The constructor sends `checkIfReady` to every actor, so each needs a resolving `send`.
        function Actor(target, parent, mapId) { ids.push(mapId); this.send = () => Promise.resolve(); }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 1);

        const workerPool = new WorkerPool();
        const dispatchers = [new Dispatcher(workerPool, {}), new Dispatcher(workerPool, {})];
        expect(ids).toStrictEqual(dispatchers.map((d) => { return d.id; }));
    });

    test('#remove destroys actors', () => {
        const actorsRemoved: Array<any> = [];
        function Actor() {
            this.send = () => Promise.resolve();
            this.remove = function () { actorsRemoved.push(this); };
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 4);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});
        dispatcher.remove();
        expect(actorsRemoved.length).toEqual(4);
    });

    test('send resolves with the per-worker results in actor order', async () => {
        const responses = [{a: 1}, {a: 2}, {a: 3}];
        let i = 0;
        function Actor() {
            const idx = i++;
            this.send = () => Promise.resolve(responses[idx]);
            this.notify = () => {};
            this.remove = () => {};
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 3);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});

        const result = await dispatcher.send('loadTileProvider', undefined);
        expect(result).toEqual(responses);
    });

    test('broadcast fans out via notify and returns void', () => {
        const notifyCalls = [];
        const sendTypes = [];
        function Actor() {
            // The constructor sends `checkIfReady` to every actor, so send must resolve.
            this.send = (type) => { sendTypes.push(type); return Promise.resolve(true); };
            this.notify = (type, data) => { notifyCalls.push([type, data]); };
            this.remove = () => {};
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 2);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});

        const result = dispatcher.broadcast('clearCaches');
        expect(result).toBeUndefined();
        expect(notifyCalls).toEqual([['clearCaches', undefined], ['clearCaches', undefined]]);
        expect(sendTypes).not.toContain('clearCaches');
    });

    test('send forwards signal to each underlying actor send', () => {
        const signals = [];
        function Actor() {
            this.send = (type, data, options) => { signals.push(options && options.signal); return Promise.resolve(); };
            this.notify = () => {};
            this.remove = () => {};
        }
        vi.spyOn(Dispatcher, 'Actor', 'get').mockImplementation(() => Actor);
        vi.spyOn(WorkerPool, 'workerCount', 'get').mockImplementation(() => 2);

        const workerPool = new WorkerPool();
        const dispatcher = new Dispatcher(workerPool, {});

        signals.length = 0; // discard the constructor's checkIfReady send
        const controller = new AbortController();
        dispatcher.send('loadTileProvider', {}, {signal: controller.signal});
        expect(signals).toEqual([controller.signal, controller.signal]);
    });

});

