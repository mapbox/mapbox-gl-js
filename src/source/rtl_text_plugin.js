'use strict';

const ajax = require('../util/ajax');
const window = require('../util/window');

const pluginAvailableCallbacks = [];
let pluginRequested = false;
let pluginBlobURL = null;

module.exports.registerForPluginAvailability = function(callback) {
    if (pluginBlobURL) {
        callback(pluginBlobURL);
    } else {
        pluginAvailableCallbacks.push(callback);
    }
    return callback;
};

module.exports.deregisterPluginCallback = function(callback) {
    const i = pluginAvailableCallbacks.indexOf(callback);
    if (i >= 0) {
        pluginAvailableCallbacks.splice(i, 1);
    }
};

module.exports.errorCallback = null;

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

            while (pluginAvailableCallbacks.length > 0) {
                pluginAvailableCallbacks.shift()(pluginBlobURL);
            }
        }
    });
};
