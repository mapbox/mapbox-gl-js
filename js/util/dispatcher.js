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
            setTimeout(function() {
                for (var i = 0; i < postListeners.length; i++) {
                    postListeners[i]({data: data, target: this.target});
                }
            }.bind(this), 0);
        }
    };
}

function Dispatcher(length, parent) {
    var parentListeners = [],
        workerListeners = [],
        parentBus = new MessageBus(workerListeners, parentListeners),
        workerBus = new MessageBus(parentListeners, workerListeners);

    parentBus.target = workerBus;
    workerBus.target = parentBus;

    this.worker = new Worker(workerBus);
    this.actor = new Actor(parentBus, parent);
}

Dispatcher.prototype = {
    broadcast: function(type, data) {
        this.actor.send(type, data);
    },

    send: function(type, data, callback, targetID, buffers) {
        this.actor.send(type, data, callback, buffers);
    },

    remove: function() {
        // noop
    }
};
