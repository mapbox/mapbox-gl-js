// @flow

import { Event, Evented } from '../util/evented';

let pluginRequested = false;
let pluginURL = null;

export const evented = new Evented();

type ErrorCallback = (error: Error) => void;

let _errorCallback;

export const registerForPluginAvailability = function(
    callback: (args: {pluginURL: string, errorCallback: ErrorCallback}) => void
) {
    if (pluginURL) {
        callback({ pluginURL: pluginURL, errorCallback: _errorCallback});
    } else {
        evented.once('pluginAvailable', callback);
    }
    return callback;
};

// Only exposed for tests
export const clearRTLTextPlugin = function() {
    pluginRequested = false;
    pluginURL = null;
};

export const setRTLTextPlugin = function(url: string, callback: ErrorCallback) {
    if (pluginRequested) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginRequested = true;
    pluginURL = url;
    evented.fire(new Event('pluginAvailable', { pluginURL: pluginURL, errorCallback: callback }));
    _errorCallback = callback;
};

export const plugin: {
    applyArabicShaping: ?Function,
    processBidirectionalText: ?(string, Array<number>) => Array<string>
} = {
    applyArabicShaping: null,
    processBidirectionalText: null
};
