'use strict';

var util = require('./util');
var Actor = require('./actor');
var WebWorker = require('./web_worker');

module.exports = Dispatcher;

/**
 * Responsible for sending messages from a {@link Source} to an associated
 * {@link WorkerSource}.
 *
 * @interface Dispatcher
 * @private
 */
function Dispatcher(length, parent) {
    this.actors = [];
    this.currentActor = 0;
    for (var i = 0; i < length; i++) {
        var worker = new WebWorker();
        var actor = new Actor(worker, parent);
        actor.name = "Worker " + i;
        this.actors.push(actor);
    }
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
        util.asyncAll(this.actors, function (actor, done) {
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
     * @param {number|undefined} [targetID] The ID of the Worker to which to send this message. Omit to allow the dispatcher to choose.
     * @returns {number} The ID of the worker to which the message was sent.
     * @memberof Dispatcher
     * @instance
     */
    send: function(type, data, callback, targetID, buffers) {
        if (typeof targetID !== 'number' || isNaN(targetID)) {
            // Use round robin to send requests to web workers.
            targetID = this.currentActor = (this.currentActor + 1) % this.actors.length;
        }

        this.actors[targetID].send(type, data, callback, buffers);
        return targetID;
    },

    remove: function() {
        for (var i = 0; i < this.actors.length; i++) {
            this.actors[i].target.terminate();
        }
        this.actors = [];
    }
};
