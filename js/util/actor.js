'use strict';

module.exports = Actor;

function Actor(target, parent) {
    this.target = target;
    this.parent = parent;
    this.callbacks = {};
    this.callbackID = 0;
    this.receive = this.receive.bind(this);
    this.target.addEventListener('message', this.receive, false);
}

Actor.prototype.receive = function(message) {
    var data = message.data,
        callback;

    if (data.type == '<response>') {
        callback = this.callbacks[data.id];
        delete this.callbacks[data.id];
        callback(data.error || null, data.data);
    } else if (typeof data.id !== 'undefined') {
        var id = data.id;
        this.parent[data.type](data.data, function response(err, data, buffers) {
            // console.warn('trying to clone', data, buffers, message.target);
            message.target.postMessage({
                type: '<response>',
                id: String(id),
                error: err ? String(err) : null,
                data: data
            }, buffers);
        });
    } else {
        this.parent[data.type](data.data);
    }
};

Actor.prototype.send = function(type, data, callback, buffers) {
    var id = null;
    if (callback) this.callbacks[id = this.callbackID++] = callback;
    this.target.postMessage({ type: type, id: String(id), data: data }, buffers);
};
