'use strict';

const Worker = require('../source/worker');

module.exports = function () {
    const parentListeners = [],
        workerListeners = [],
        parentBus = new MessageBus(workerListeners, parentListeners),
        workerBus = new MessageBus(parentListeners, workerListeners);

    parentBus.target = workerBus;
    workerBus.target = parentBus;
    // workerBus substitutes the WebWorker global `self`, and Worker uses
    // self.importScripts for the 'loadWorkerSource' target.
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
        removeEventListener: function(event, callback) {
            const i = addListeners.indexOf(callback);
            if (i >= 0) {
                addListeners.splice(i, 1);
            }
        },
        postMessage: function(data) {
            setImmediate(() => {
                for (let i = 0; i < postListeners.length; i++) {
                    postListeners[i]({data: data, target: this.target});
                }
            });
        },
        terminate: function() {
            addListeners.splice(0, addListeners.length);
            postListeners.splice(0, postListeners.length);
        }
    };
}

