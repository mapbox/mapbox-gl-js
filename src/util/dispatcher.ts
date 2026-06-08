import {uniqueId} from './util';
import Actor from './actor';
import assert from '../style-spec/util/assert';
import WorkerPool from './worker_pool';

import type Style from '../style/style';
import type {WorkerInbox} from './actor_messages';

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
        this.broadcast('checkIfReady', null, {keepResult: true}).then(() => { this.ready = true; }).catch(() => {});
    }

    /**
     * Broadcast a message to all Workers.
     *
     * By default, broadcasts are fire-and-forget and return `void`. Pass `{keepResult: true}` to
     * receive a Promise that resolves with the array of per-worker results (or rejects if any worker rejects).
     *
     * @private
     */
    broadcast<T extends keyof WorkerInbox>(type: T, data: WorkerInbox[T]['params'], options: {keepResult: true; signal?: AbortSignal}): Promise<Array<WorkerInbox[T]['result']>>;
    broadcast<T extends keyof WorkerInbox>(type: T, data?: WorkerInbox[T]['params']): void;
    broadcast<T extends keyof WorkerInbox>(type: T, data?: WorkerInbox[T]['params'], options?: {keepResult?: boolean; signal?: AbortSignal}): Promise<Array<WorkerInbox[T]['result']>> | void {
        assert(this.actors.length);
        const {signal, keepResult = false} = options || {};

        if (keepResult) {
            return Promise.all(this.actors.map(actor => actor.send(type, data, {signal})));
        }

        for (const actor of this.actors) {
            actor.send(type, data, {skipResult: true});
        }
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
