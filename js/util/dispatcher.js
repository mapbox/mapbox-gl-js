'use strict';

var util = require('./util');
var workerPool = require('./worker_pool');

module.exports = Dispatcher;

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @interface Dispatcher
 * @private
 */
function Dispatcher(length, parent) {
    this.id = util.uniqueId();
    this.actors = workerPool.requestActors(this.id, length, parent);
    this.currentActor = 0;
}

Dispatcher.prototype = {
    /**
     * Broadcast a message to all Workers.
     * @method
     * @name broadcast
     * @param {string} type
     * @param {object} data
     * @param {Function} callback
     * @memberof Dispatcher
     * @instance
     */
    broadcast: function(type, data, cb) {
        cb = cb || function () {};
        util.asyncAll(this.actors.getAll(), function (actor, done) {
            actor.send(type, data, done);
        }, cb);
    },

    /**
     * Send a message to a Worker.
     * @method
     * @name send
     * @param {string} type
     * @param {object} data
     * @param {Function} callback
     * @param {string|undefined} [actorKey] When defined, messages send with a given value of actorKey will always be sent to the same actor.
     * @memberof Dispatcher
     * @instance
     */
    send: function(type, data, callback, actorKey, buffers) {
        this.actors.get(actorKey).send(type, data, callback, buffers);
    },

    remove: function() {
        this.actors.release();
    }
};
