'use strict';
// @flow

const ajax = require('../util/ajax');
const Evented = require('../util/evented');
const window = require('../util/window');

let pluginRequested = false;
let pluginBlobURL = null;

module.exports.evented = new Evented();

type ErrorCallback = (error: Error) => void;

module.exports.registerForPluginAvailability = function(
    callback: (pluginBlobURL: string, errorCallback: ErrorCallback) => void
) {
    if (pluginBlobURL) {
        callback(pluginBlobURL, module.exports.errorCallback);
    } else {
        module.exports.evented.once('pluginAvailable', callback);
    }
    return callback;
};

module.exports.setRTLTextPlugin = function(pluginURL: string, callback: ErrorCallback) {
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
