import {uniqueId, asyncAll} from './util';
import Actor from './actor';
import assert from '../style-spec/util/assert';
import WorkerPool from './worker_pool';

import type Style from '../style/style';
import type {Callback} from '../types/callback';
import type {ActorCallback} from './actor';
import type {WorkerInbox} from './actor_messages';

/**
 * Utility type that converts an `ActorCallback<T>` to an `ActorCallback<T[]>` or `Callback<T[]>`.
 */
export type DispatcherCallback<T = unknown> = T extends ActorCallback<infer U> ? ActorCallback<U[]> : Callback<T[]>;

/**
 * Responsible for sending messages from a {@link Style} to an associated
 * {@link WorkerSource}.
 *
 * @private
 */
class Dispatcher {
    id: number;
    ready: boolean;
    actors: Actor<WorkerInbox>[];
    workerPool: WorkerPool;
    currentActor: number;

    // exposed to allow stubbing in unit tests
    static Actor: typeof Actor;

    constructor(workerPool: WorkerPool, style: Style, name = 'Worker', count = WorkerPool.workerCount) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = uniqueId();

        const workers = this.workerPool.acquire(this.id, count);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Dispatcher.Actor<WorkerInbox>(worker, style, this.id);
            actor.name = `${name} ${i}`;
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
    broadcast<T extends keyof WorkerInbox>(type: T, data?: WorkerInbox[T]['params'], cb?: DispatcherCallback<WorkerInbox[T]['callback']>) {
        assert(this.actors.length);
        cb = cb || function () {} as DispatcherCallback<WorkerInbox[T]['callback']>;
        asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done);
        }, cb);
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns {Actor} An actor object backed by a web worker for processing messages.
     */
    getActor(): Actor<WorkerInbox> {
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
