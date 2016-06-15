'use strict';

var Worker = require('../source/worker');
var Actor = require('../util/actor');

module.exports = Dispatcher;

function MessageBus(addListeners, postListeners) {
    return {
        addEventListener: function(event, callback) {
            if (event === 'message') {
                addListeners.push(callback);
            }
        },
        postMessage: function(data) {
            setImmediate(function() {
                for (var i = 0; i < postListeners.length; i++) {
                    postListeners[i]({data: data, target: this.target});
                }
            }.bind(this));
        }
    };
}

function Dispatcher(length, parent) {

    this.actors = new Array(length);

    var parentListeners = [],
        workerListeners = [],
        parentBus = new MessageBus(workerListeners, parentListeners),
        workerBus = new MessageBus(parentListeners, workerListeners);

    parentBus.target = workerBus;
    workerBus.target = parentBus;
    // workerBus substitutes the WebWorker global `self`, and Worker uses
    // self.importScripts for the 'load worker source' target.
    workerBus.importScripts = function () {};

    this.worker = new Worker(workerBus);

    // TODO: this is here temporarily to allow tests to work until the geojson
    // worker source has been hard-coded into the Worker instead of loaded
    // asynchronously
    var GeoJSONWorkerSource = require('../source/geojson_worker_source.js');
    this.worker.workerSources.geojson = new GeoJSONWorkerSource();

    this.actor = new Actor(parentBus, parent);

    this.remove = function() {
        parentListeners.splice(0, parentListeners.length);
        workerListeners.splice(0, workerListeners.length);
    };
}

Dispatcher.prototype = {
    broadcast: function(type, data, callback) {
        this.actor.send(type, data, callback);
    },

    send: function(type, data, callback, targetID, buffers) {
        this.actor.send(type, data, callback, buffers);
    }
};
