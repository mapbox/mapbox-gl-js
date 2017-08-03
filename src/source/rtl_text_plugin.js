// @flow

const ajax = require('../util/ajax');
const Evented = require('../util/evented');
const window = require('../util/window');

let pluginRequested = false;
let pluginBlobURL = null;

module.exports.evented = new Evented();

type ErrorCallback = (error: Error) => void;

module.exports.registerForPluginAvailability = function(
    callback: (args: {pluginBlobURL: string, errorCallback: ErrorCallback}) => void
) {
    if (pluginBlobURL) {
        callback({ pluginBlobURL: pluginBlobURL, errorCallback: module.exports.errorCallback});
    } else {
        module.exports.evented.once('pluginAvailable', callback);
    }
    return callback;
};

// Exposed so it can be stubbed out by tests
module.exports.createBlobURL = function(response: Object) {
    return window.URL.createObjectURL(new window.Blob([response.data], {type: "text/javascript"}));
};
// Only exposed for tests
module.exports.clearRTLTextPlugin = function() {
    pluginRequested = false;
    pluginBlobURL = null;
};

module.exports.setRTLTextPlugin = function(pluginURL: string, callback: ErrorCallback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    module.exports.errorCallback = callback;
    ajax.getArrayBuffer({ url: pluginURL }, (err, response) => {
        if (err) {
            callback(err);
        } else if (response) {
            pluginBlobURL = module.exports.createBlobURL(response);
            module.exports.evented.fire('pluginAvailable', { pluginBlobURL: pluginBlobURL, errorCallback: callback });
        }
    });
};

module.exports.applyArabicShaping = (null: ?Function);
module.exports.processBidirectionalText = (null: ?(string, Array<number>) => Array<string>);
