// Manages the WebWorker

function Actor() {
    this.handlers = {}, actor = this;
    self.addEventListener('message', function(e) {
        var data = e.data,
            respond = function(error, message, buffers) {
                if (error != null && error.constructor.toString().toLowerCase().indexOf('error') != -1) {
                    error = String(error);
                }
                self.postMessage({
                    type: 'response',
                    id: data.id,
                    error: error,
                    data: message
                }, buffers);
            };

        if (actor.handlers[data.type]) {
            for (var i = 0; i < actor.handlers[data.type].length; i++) {
                actor.handlers[data.type][i](data.data, respond);
            }
        }

    }, false);
}

Actor.prototype.on = function(ev, fn) {
    if (!this.handlers[ev]) this.handlers[ev] = [];
    this.handlers[ev].push(fn);
    return this;
};

self.actor = (new Actor());

console = {
    log: function() {
        self.postMessage({
            type: 'debug',
            messages: arguments
        });
    },
    warn: function() {
        self.postMessage({
            type: 'debug',
            messages: arguments
        });
    }
};

alert = function() {
    self.postMessage({
        type: 'alert',
        messages: arguments
    });
};

importScripts('/js/vectortileloader.js', '/js/geometry.js');
