'use strict';

var Worker = require('../source/worker');

module.exports = function () {
    var parentListeners = [],
        workerListeners = [],
        parentBus = new MessageBus(workerListeners, parentListeners),
        workerBus = new MessageBus(parentListeners, workerListeners);

    parentBus.target = workerBus;
    workerBus.target = parentBus;
    // workerBus substitutes the WebWorker global `self`, and Worker uses
    // self.importScripts for the 'load worker source' target.
    workerBus.importScripts = function () {};

    new Worker(workerBus);

    return parentBus;
};

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
        },
        terminate: function() {
            addListeners.splice(0, addListeners.length);
            postListeners.splice(0, postListeners.length);
        }
    };
}

