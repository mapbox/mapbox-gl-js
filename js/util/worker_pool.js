'use strict';

var assert = require('assert');
var Actor = require('./actor');
var WebWorker = require('./web_worker');

/**
 * A pool for sharing Worker instances across Map instances on the same page.
 * Maintains the relationship Dispatcher:Actor:Worker :: 1:many:1, with Actors
 * serving essentially as individual dispatcher-worker connections.
 *
 * @private
 */
var WorkerPool = {
    reset: function () {
        this.workers = [];
        this.actors = {};
        this.parents = {};
        this.currentWorker = 0;
        this.uidToActor = {};
    },

    requestActors: function (dispatcherId, actorCount, parent) {
        assert(!this.actors[dispatcherId]);
        this.actors[dispatcherId] = [];
        this.parents[dispatcherId] = parent;
        resize(this.workers, actorCount);

        return {
            release: this.releaseActors.bind(this, dispatcherId),
            get: this.getActor.bind(this, dispatcherId),
            getAll: this.getAllActors.bind(this, dispatcherId)
        };
    },

    /**
     * Release the given dispatcherId's claim on the workers, and clean up
     * worker instances if this was the last claim.
     */
    releaseActors: function (dispatcherId) {
        assert(this.actors[dispatcherId]);
        var removed = this.actors[dispatcherId];
        delete this.actors[dispatcherId];

        if (Object.keys(this.actors).length === 0) {
            for (var i = 0; i < removed.length; i++) {
                this.actors[i].target.terminate();
            }
            this.reset();
        }
    },

    /**
     * Get an actor for the given dispatcher.  If `uid` is provided, then
     * subsequent calls with the same value of uid will return the same Actor
     * (with the same target Worker).
     */
    getActor: function (dispatcherId, uid) {
        assert(this.actors[dispatcherId]);
        var actorId;
        if (typeof uid !== 'undefined' && typeof this.uidToActor[uid] !== 'undefined') {
            actorId = this.uidToActor[uid];
        } else {
            // Use round robin to send requests to web workers.
            actorId = this.currentWorker = (this.currentWorker + 1) % this.workers.length;
            if (typeof uid !== 'undefined') {
                this.uidToActor[uid] = actorId;
            }
        }

        this.ensureActor(dispatcherId, actorId);
        return this.actors[dispatcherId][actorId];
    },

    getAllActors: function (dispatcherId) {
        assert(this.actors[dispatcherId]);
        for (var i = 0; i < this.workers.length; i++) {
            this.ensureActor(dispatcherId, i);
        }
        return this.actors[dispatcherId].slice();
    },

    ensureActor: function (dispatcherId, actorId) {
        assert(actorId < this.workers.length);

        if (!this.actors[dispatcherId][actorId]) {
            var actor = new Actor(this.workers[actorId], this.parents[dispatcherId], dispatcherId);
            actor.name = "Actor " + actorId;
            this.actors[dispatcherId][actorId] = actor;
        }
    }
};

WorkerPool.reset();
module.exports = WorkerPool;

function resize(workerList, length) {
    while (workerList.length < length) {
        workerList.push(new WebWorker());
    }
}
