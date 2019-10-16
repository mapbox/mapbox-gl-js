// @flow

import {Event, Evented} from '../util/evented';
import {getArrayBuffer} from '../util/ajax';
import browser from '../util/browser';
import window from '../util/window';

const status = {
    unavailable: 'unavailable', // Not loaded
    available: 'available', // Host url specified, but we havent started loading yet
    loading: 'loading', // request in-flight
    downloaded: 'downloaded', //plugin loaded and cached on main-thread and pluginBlobURL for worker is generated
    loaded: 'loaded',
    error: 'error'
};
let pluginStatus = status.unavailable;
let pluginURL = null;
let pluginBlobURL = null;
let lazy = null;

// store `pluginAvailable` that have occurred before the `registerPluginAvailability` bind
// so we can flush all the state updates to the workers
let eventQueue = [];
let _pluginAvailableCb = null;

let _workerAvailable = false;

export const evented = new Evented();
evented.on('pluginAvailable', (args) => {
    if (!_pluginAvailableCb) {
        eventQueue.push(args);
    } else {
        _pluginAvailableCb(args);
    }
});

type CompletionCallback = (error?: Error) => void;
type ErrorCallback = (error: Error) => void;
type PluginAvailableCallback = (args: {pluginURL: ?string, lazy: ?boolean, completionCallback: CompletionCallback}) => void;

let _completionCallback;

export const getRTLTextPluginStatus = function () {
    return pluginStatus;
};

export const registerForPluginAvailability = function(callback: PluginAvailableCallback) {
    for (const event of eventQueue) {
        callback(event);
    }
    eventQueue = [];

    _pluginAvailableCb = callback;
    return callback;
};

export const clearRTLTextPlugin = function() {
    pluginStatus = status.unavailable;
    pluginURL = null;
    pluginBlobURL = null;
    lazy = null;
};

export const setRTLTextPlugin = function(url: string, callback: ?ErrorCallback, lazyLoad: ?boolean) {
    if (pluginStatus === status.available || pluginStatus === status.loading || pluginStatus === status.loaded) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginURL = browser.resolveURL(url);
    lazy = !!lazyLoad;
    pluginStatus = status.available;
    _completionCallback = (error?: Error) => {
        if (error) {
            // Clear loaded state to allow retries
            clearRTLTextPlugin();
            pluginStatus = status.error;
            if (callback) {
                callback(error);
            }
        } else {
            // Called once for each worker
            if (!lazy) {
                pluginStatus = status.loaded;
            }
        }
    };

    if (lazy) {
        // Inform the worker-threads that we intend to load the plugin lazily later,
        // This is so the workers can skip RTL text parsing.
        evented.fire(new Event('pluginAvailable', {
            pluginURL: null,
            lazy,
            completionCallback: _completionCallback
        }));
    } else {
        downloadRTLTextPlugin();
    }
};

export const downloadRTLTextPlugin = function() {
    if (pluginStatus !== status.available) {
        throw new Error('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
    }
    pluginStatus = status.loading;

    if (pluginURL) {
        getArrayBuffer({url: pluginURL}, (error, data) => {
            if (error || !data) {
                throw error;
            } else {
                const rtlBlob = new window.Blob([data], {type: 'application/javascript'});
                const URL = window.URL || window.webkitURL;
                pluginBlobURL = URL.createObjectURL(rtlBlob);
                pluginStatus = status.downloaded;
                evented.fire(new Event('pluginAvailable', {
                    pluginURL: pluginBlobURL,
                    lazy,
                    completionCallback: _completionCallback
                }));
            }
        });
    }
};

export const plugin: {
    applyArabicShaping: ?Function,
    processBidirectionalText: ?(string, Array<number>) => Array<string>,
    processStyledBidirectionalText: ?(string, Array<number>, Array<number>) => Array<[string, Array<number>]>,
    isLoaded: () => boolean,
    isLoading: () => boolean,
    markWorkerAvailable: () => void,
    isAvailableInWorker: () => boolean
} = {
    applyArabicShaping: null,
    processBidirectionalText: null,
    processStyledBidirectionalText: null,
    isLoaded() {
        return pluginStatus === status.loaded || // Main Thread: loaded if the completion callback returned successfully
            plugin.applyArabicShaping != null; // Web-worker: loaded if the plugin functions have been compiled
    },
    isLoading() { // Main Thread Only: query the loading status, this function does not return the correct value in the worker context.
        return pluginStatus === status.loading;
    },
    markWorkerAvailable() { // Worker thread only: this tells the worker threads that the plugin is available on the Main thread
        _workerAvailable = true;
    },
    isAvailableInWorker() {
        return !!_workerAvailable;
    }
};
