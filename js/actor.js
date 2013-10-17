// Bootstraps a worker

function Actor() {
    var actor = this;
    addEventListener('message', function(e) {
        var data = e.data;
        var id = data.id;
        actor[data.type](data.data, function(err, data, buffers) {
            postMessage({
                type: '<response>',
                id: id,
                error: err ? String(err) : null,
                data: data
            }, buffers);
        });
    }, false);
}

Actor.prototype.send = function(type, error, data, buffers) {
    postMessage({ type: type, error: error, data: data }, buffers);
};

var actor = new Actor();

// Debug
if (typeof console === 'undefined') {
    console = {};
    console.log = console.warn = function() {
        actor.send('debug', null, _.toArray(arguments));
    };
}

if (typeof alert === 'undefined') {
    alert = function() {
        actor.send('alert', null, _.toArray(arguments));
    };
}

importScripts('/gl/js/vectortileloader.js');
