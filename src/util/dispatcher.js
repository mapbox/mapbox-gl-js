// @flow

import {uniqueId, asyncAll} from './util.js';
import Actor from './actor.js';
import assert from 'assert';

import type WorkerPool from './worker_pool.js';

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @private
 */
class Dispatcher {
    workerPool: WorkerPool;
    actors: Array<Actor>;
    currentActor: number;
    id: number;
    ready: boolean;

    // exposed to allow stubbing in unit tests
    static Actor: Class<Actor>;

    constructor(workerPool: WorkerPool, parent: any) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = uniqueId();
        const workers = this.workerPool.acquire(this.id);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Dispatcher.Actor(worker, parent, this.id);
            actor.name = `Worker ${i}`;
            this.actors.push(actor);
        }
        assert(this.actors.length);

        // track whether all workers are instantiated and ready to receive messages;
        // used for optimizations on initial map load
        this.ready = false;
        this.broadcast('checkIfReady', null, () => { this.ready = true; });
    }

    /**
     * Broadcast a message to all Workers.
     * @private
     */
    broadcast(type: string, data: mixed, cb?: Function) {
        assert(this.actors.length);
        cb = cb || function () {};
        asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done);
        }, cb);
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns An actor object backed by a web worker for processing messages.
     */
    getActor(): Actor {
        assert(this.actors.length);
        this.currentActor = (this.currentActor + 1) % this.actors.length;
        return this.actors[this.currentActor];
    }

    remove() {
        this.actors.forEach((actor) => { actor.remove(); });
        this.actors = [];
        this.workerPool.release(this.id);
    }
}

Dispatcher.Actor = Actor;

export default Dispatcher;
