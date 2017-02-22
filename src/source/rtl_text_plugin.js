'use strict';

const ajax = require('../util/ajax');
const Evented = require('../util/evented');
const window = require('../util/window');

let pluginRequested = false;
let pluginBlobURL = null;

module.exports.evented = new Evented();

module.exports.registerForPluginAvailability = function(callback) {
    if (pluginBlobURL) {
        callback(pluginBlobURL, module.exports.errorCallback);
    } else {
        module.exports.evented.once('pluginAvailable', callback);
    }
    return callback;
};

module.exports.setRTLTextPlugin = function(pluginURL, callback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    module.exports.errorCallback = callback;
    ajax.getArrayBuffer(pluginURL, (err, response) => {
        if (err) {
            callback(err);
        } else {
            pluginBlobURL =
                window.URL.createObjectURL(new window.Blob([response.data]), {type: "text/javascript"});

            module.exports.evented.fire('pluginAvailable', { pluginBlobURL: pluginBlobURL, errorCallback: callback });
        }
    });
};
