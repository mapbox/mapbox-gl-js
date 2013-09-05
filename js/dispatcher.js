// Manages the WebWorker

function Dispatcher(actors) {
    this.actors = [];
    for (var i = 0; i < actors; i++) {
        this.actors.push(new Worker('/js/actor.js'));
        this.actors[i].addEventListener('message', _.bind(this.receiveMessage, this), false);
    }

    this.callbacks = {};
    this.contexts = {};
    this.callbackId = 0;
    this.currentActor = 0;
}

Dispatcher.prototype.receiveMessage = function(message) {
    var data = message.data, error = null;
    if (data.type == 'response') {
        if (typeof data.error == 'Error') {
            error = data.error;
        }
        else if (error !== null) {
            error = new Error(data.error);
        }
        this.callbacks[data.id].call(this.contexts[data.id], error, data.data);
        delete this.callbacks[data.id];
    }
    else if (data.type == 'debug') {
        console.log.apply(console, _.toArray(data.messages));
    } else if (data.type == 'alert') {
        alert.apply(window, _.toArray(data.messages));
    }
};

Dispatcher.prototype.send = function(type, data, callback, target, buffers, context) {
    if (!target || target === null) {
        target = this.currentActor = (this.currentActor + 1) % this.actors.length;
    }
    var id;
    if (callback) {
        id = this.callbackId++;
        this.callbacks[id] = callback;
        this.contexts[id] = context;
    }
    if (target == 'all') {
        for (var i = 0; i < this.actors.length; i++) {
            this.actors[i].postMessage({
                id: id,
                data: data,
                type: type
            }, buffers);
        }
    }
    else {
        this.actors[target].postMessage({
            id: id,
            data: data,
            type: type
        }, buffers);
    }
    return target;
};

