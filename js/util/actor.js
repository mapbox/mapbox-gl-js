'use strict';

module.exports = Actor;

/**
 * An implementation of the [Actor design pattern](http://en.wikipedia.org/wiki/Actor_model)
 * that maintains the relationship between asynchronous tasks and the objects
 * that spin them off - in this case, tasks like parsing parts of styles,
 * owned by the styles
 *
 * @param {WebWorker} target
 * @param {WebWorker} parent
 * @param {string|number} mapId A unique identifier for the Map instance using this Actor.
 * @private
 */
function Actor(target, parent, mapId) {
    this.target = target;
    this.parent = parent;
    this.mapId = mapId;
    this.callbacks = {};
    this.callbackID = 0;
    this.receive = this.receive.bind(this);
    this.target.addEventListener('message', this.receive, false);
}

Actor.prototype.receive = function(message) {
    var data = message.data,
        id = data.id,
        callback;

    if (data.type === '<response>') {
        callback = this.callbacks[data.id];
        delete this.callbacks[data.id];
        if (callback) callback(data.error || null, data.data);
    } else if (typeof data.id !== 'undefined' && this.parent[data.type]) {
        // data.type == 'load tile', 'remove tile', etc.
        this.parent[data.type](data.mapId, data.data, done.bind(this));
    } else if (typeof data.id !== 'undefined' && this.parent.getWorkerSource) {
        // data.type == sourcetype.method
        var keys = data.type.split('.');
        var workerSource = this.parent.getWorkerSource(data.mapId, keys[0]);
        workerSource[keys[1]](data.data, done.bind(this));
    } else {
        this.parent[data.type](data.data);
    }

    function done(err, data, buffers) {
        this.postMessage({
            mapId: this.mapId,
            type: '<response>',
            id: String(id),
            error: err ? String(err) : null,
            data: data
        }, buffers);
    }
};

Actor.prototype.send = function(type, data, callback, buffers) {
    var id = callback ? this.mapId + ':' + this.callbackID++ : null;
    if (callback) this.callbacks[id] = callback;
    this.postMessage({ mapId: this.mapId, type: type, id: String(id), data: data }, buffers);
};

/**
 * Wrapped postMessage API that abstracts around IE's lack of
 * `transferList` support.
 *
 * @param {Object} message
 * @param {Object} transferList
 * @private
 */
Actor.prototype.postMessage = function(message, transferList) {
    this.target.postMessage(message, transferList);
};
