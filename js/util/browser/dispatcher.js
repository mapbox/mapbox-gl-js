'use strict';

var Actor = require('../actor');

var scripts = document.getElementsByTagName("script");
var workerFile = (document.currentScript || scripts[scripts.length - 1]).getAttribute('src');
var absolute = workerFile.indexOf('http') !== -1;

module.exports = Dispatcher;

function Dispatcher(length, parent) {
    this.actors = [];
    this.currentActor = 0;

    var url, blob, i;

    for (i = 0; i < length; i++) {
        // due to cross domain issues we can't load it directly with the url,
        // so create a blob and object url and load that
        if (absolute) {
            blob = new Blob(['importScripts("' + workerFile + '");'], {type: 'application/javascript'});
            url = window.URL.createObjectURL(blob);
        } else {
            url = workerFile;
        }

        var worker = new window.Worker(url);
        var actor = new Actor(worker, parent);
        actor.name = "Worker " + i;
        this.actors.push(actor);
    }
}

Dispatcher.prototype = {
    broadcast: function(type, data) {
        for (var i = 0; i < this.actors.length; i++) {
            this.actors[i].send(type, data);
        }
    },

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
