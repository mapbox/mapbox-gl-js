// Manages the WebWorkers

function Dispatcher(length, parent) {
    this.actors = [];
    this.currentActor = 0;

    for (var i = 0; i < length; i++) {
        var worker = new Worker('/gl/js/worker.js');
        var actor = new Actor(worker, parent);
        actor.name = "Worker " + i;
        this.actors.push(actor);
    }
}

Dispatcher.prototype.broadcast = function(type, data) {
    for (var i = 0; i < this.actors.length; i++) {
        this.actors[i].send(type, data);
    }
};

Dispatcher.prototype.send = function(type, data, callback, targetID, buffers) {
    if (!targetID || targetID === null) {
        // Use round robin to send requests to web workers.
        targetID = this.currentActor = (this.currentActor + 1) % this.actors.length;
    }

    this.actors[targetID].send(type, data, callback, buffers);
    return targetID;
};

