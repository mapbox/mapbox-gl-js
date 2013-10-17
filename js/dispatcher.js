// Manages the WebWorker

function Dispatcher(actors) {
    this.actors = [];
    for (var i = 0; i < actors; i++) {
        this.actors.push(new Worker('/gl/js/actor.js'));
        this.actors[i].name = "Worker" + i;
        this.actors[i].addEventListener('message', _.bind(this.receiveMessage, this), false);
    }

    this.callbacks = {};
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
        this.callbacks[data.id](error, data.data);
        delete this.callbacks[data.id];
    }
    else if (data.type == 'debug') {
        console.log.apply(console, _.toArray(data.messages));
    } else if (data.type == 'alert') {
        alert.apply(window, _.toArray(data.messages));
    }
};

Dispatcher.prototype.broadcast = function(type, data) {
    for (var i = 0; i < this.actors.length; i++) {
        this.actors[i].postMessage({ type: type, data: data });
    }
};

Dispatcher.prototype.send = function(type, data, callback, target, buffers) {
    if (!target || target === null) {
        // Use round robin to send requests to web workers.
        target = this.currentActor = (this.currentActor + 1) % this.actors.length;
    }
    var id;
    if (callback) {
        id = this.callbackId++;
        this.callbacks[id] = callback;
    }
    this.actors[target].postMessage({
        id: id,
        data: data,
        type: type
    }, buffers);

    return target;
};

