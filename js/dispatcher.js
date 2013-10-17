// Manages the WebWorker

function Dispatcher(actors) {
    this.actors = [];
    this.receiveMessage = this.receiveMessage.bind(this);

    for (var i = 0; i < actors; i++) {
        this.actors.push(new Worker('/gl/js/worker.js'));
        this.actors[i].name = "Worker" + i;
        this.actors[i].addEventListener('message', this.receiveMessage, false);
    }

    this.callbacks = {};
    this.callbackId = 0;
    this.currentActor = 0;
}

Dispatcher.prototype.receiveMessage = function(message) {
    var data = message.data, error = null;
    if (data.type == '<response>') {
        var callback = this.callbacks[data.id];
        delete this.callbacks[data.id];
        callback(data.error || null, data.data);
    } else {
        this[data.type](data.error || null, data.data);
    }
};

Dispatcher.prototype['debug'] = function(err, data) {
    console.log.apply(console, data);
};

Dispatcher.prototype['alert'] = function(err, data) {
    alert.apply(window, data);
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

