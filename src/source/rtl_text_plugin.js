// @flow

const {Event, Evented} = require('../util/evented');

let pluginRequested = false;
let pluginURL = null;

module.exports.evented = new Evented();

type ErrorCallback = (error: Error) => void;

module.exports.registerForPluginAvailability = function(
    callback: (args: {pluginURL: string, errorCallback: ErrorCallback}) => void
) {
    if (pluginURL) {
        callback({ pluginURL: pluginURL, errorCallback: module.exports.errorCallback});
    } else {
        module.exports.evented.once('pluginAvailable', callback);
    }
    return callback;
};

// Only exposed for tests
module.exports.clearRTLTextPlugin = function() {
    pluginRequested = false;
    pluginURL = null;
};

module.exports.setRTLTextPlugin = function(url: string, callback: ErrorCallback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    pluginURL = url;
    module.exports.errorCallback = callback;
    module.exports.evented.fire(new Event('pluginAvailable', { pluginURL: pluginURL, errorCallback: callback }));
};

module.exports.applyArabicShaping = (null: ?Function);
module.exports.processBidirectionalText = (null: ?(string, Array<number>) => Array<string>);
