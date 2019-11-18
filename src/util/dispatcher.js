// @flow

import {uniqueId, asyncAll} from './util';
import Actor from './actor';
import assert from 'assert';

import createWorker from './web_worker';

const maxActorUses = 10;
const maxWorkerCount = 2;

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @private
 */
class Dispatcher {
    actors: Array<Actor>;
    id: number;
    parent: any;
    broadcastMessages: {string: mixed};

    // exposed to allow stubbing in unit tests
    static Actor: Class<Actor>;

    constructor(parent: any) {
        this.actors = [];
        this.id = uniqueId();
        this.parent = parent;
        this.broadcastMessages = {};

        while (this.actors.length < maxWorkerCount) {
            this.actors.push(this.createActor());
        }
    }

    /**
     * Broadcast a message to all Workers.
     */
    broadcast(type: string, data: mixed, cb?: Function) {
        // HACK: Store broadcast messages so we can send them to newly created workers.
        this.broadcastMessages[type] = data;

        cb = cb || function () {};
        asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done);
        }, cb);
    }

    createActor(): Actor {
        const actor = new Dispatcher.Actor(createWorker(), this.parent, this.id);
        for (const type in this.broadcastMessages) {
            actor.send(type, this.broadcastMessages[type]);
        }
        return actor;
    }

    /**
     * Acquires an actor to dispatch messages to. The actors are distributed in round-robin fashion.
     * @returns An actor object backed by a web worker for processing messages.
     */
    getActor(): Actor {
        // We're removing the actor from the front of the queue and re-add it to the back of the queue
        // if we can still reuse it to achieve a round-robin effect.
        const actor = this.actors.shift();
        if (++actor.uses < maxActorUses) {
            this.actors.push(actor);
        } else {
            this.actors.push(this.createActor());
        }
        ++actor.references;
        return actor;
    }

    returnActor(actor: Actor) {
        assert(actor.references >= 0);
        if (--actor.references <= 0 && actor.uses >= maxActorUses) {
            actor.remove();
        }
    }

    remove() {
        this.actors.forEach((actor) => { actor.remove(); });
        this.actors = [];
    }
}

Dispatcher.Actor = Actor;

export default Dispatcher;
