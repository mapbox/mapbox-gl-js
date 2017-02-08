'use strict';

const util = require('./util');
const Actor = require('./actor');

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @interface Dispatcher
 * @private
 */
class Dispatcher {

    constructor(workerPool, parent) {
        this.workerPool = workerPool;
        this.actors = [];
        this.currentActor = 0;
        this.id = util.uniqueId();
        const workers = this.workerPool.acquire(this.id);
        for (let i = 0; i < workers.length; i++) {
            const worker = workers[i];
            const actor = new Actor(worker, parent, this.id);
            actor.name = `Worker ${i}`;
            this.actors.push(actor);
        }
    }

    /**
     * Broadcast a message to all Workers.
     * @method
     * @name broadcast
     * @param {string} type
     * @param {Object} data
     * @param {Function} callback
     * @memberof Dispatcher
     * @instance
     */
    broadcast(type, data, cb) {
        cb = cb || function () {};
        util.asyncAll(this.actors, (actor, done) => {
            actor.send(type, data, done);
        }, cb);
    }

    /**
     * Send a message to a Worker.
     * @method
     * @name send
     * @param {string} type
     * @param {Object} data
     * @param {Function} callback
     * @param {number|undefined} [targetID] The ID of the Worker to which to send this message. Omit to allow the dispatcher to choose.
     * @returns {number} The ID of the worker to which the message was sent.
     * @memberof Dispatcher
     * @instance
     */
    send(type, data, callback, targetID, buffers) {
        if (typeof targetID !== 'number' || isNaN(targetID)) {
            // Use round robin to send requests to web workers.
            targetID = this.currentActor = (this.currentActor + 1) % this.actors.length;
        }

        this.actors[targetID].send(type, data, callback, buffers);
        return targetID;
    }

    remove() {
        this.actors.forEach((actor) => { actor.remove(); });
        this.actors = [];
        this.workerPool.release(this.id);
    }
}

module.exports = Dispatcher;
