'use strict';

var Actor = require('./actor.js');

var scripts = document.getElementsByTagName("script");
var workerFile = scripts[scripts.length - 1].getAttribute('src');



// Manages the WebWorkers
module.exports = Dispatcher;
function Dispatcher(length, parent) {
    this.actors = [];
    this.currentActor = 0;


    for (var i = 0; i < length; i++) {
        var worker = new Worker(workerFile);
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
    if (typeof targetID !== 'number' || isNaN(targetID)) {
        // Use round robin to send requests to web workers.
        targetID = this.currentActor = (this.currentActor + 1) % this.actors.length;
    }

    this.actors[targetID].send(type, data, callback, buffers);
    return targetID;
};

