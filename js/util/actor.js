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

/**
 * Sends a message from a main-thread map to a Worker or from a Worker back to
 * a main-thread map instance.
 *
 * @param {string} type The name of the target method to invoke or '[source-type].name' for a method on a WorkerSource.
 * @param {object} data
 * @param {Function} [callback]
 * @param {Array} [buffers] A list of buffers to "transfer" (see https://developer.mozilla.org/en-US/docs/Web/API/Transferable)
 * @param {string} [targetMapId] A particular mapId to which to send this message.
 * @private
 */
Actor.prototype.send = function(type, data, callback, buffers, targetMapId) {
    var id = callback ? this.mapId + ':' + this.callbackID++ : null;
    if (callback) this.callbacks[id] = callback;
    this.target.postMessage({
        targetMapId: targetMapId,
        sourceMapId: this.mapId,
        type: type,
        id: String(id),
        data: data
    }, buffers);
};

Actor.prototype.receive = function(message) {
    var data = message.data,
        id = data.id,
        callback;

    if (data.targetMapId && this.mapId !== data.targetMapId)
        return;

    if (data.type === '<response>') {
        callback = this.callbacks[data.id];
        delete this.callbacks[data.id];
        if (callback) callback(data.error || null, data.data);
    } else if (typeof data.id !== 'undefined' && this.parent[data.type]) {
        // data.type == 'load tile', 'remove tile', etc.
        this.parent[data.type](data.sourceMapId, data.data, done.bind(this));
    } else if (typeof data.id !== 'undefined' && this.parent.getWorkerSource) {
        // data.type == sourcetype.method
        var keys = data.type.split('.');
        var workerSource = this.parent.getWorkerSource(data.sourceMapId, keys[0]);
        workerSource[keys[1]](data.data, done.bind(this));
    } else {
        this.parent[data.type](data.data);
    }

    function done(err, data, buffers) {
        this.target.postMessage({
            sourceMapId: this.mapId,
            type: '<response>',
            id: String(id),
            error: err ? String(err) : null,
            data: data
        }, buffers);
    }
};

Actor.prototype.remove = function () {
    this.target.removeEventListener('message', this.receive, false);
};
