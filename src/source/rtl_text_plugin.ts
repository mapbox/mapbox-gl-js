import {Event, Evented} from '../util/evented';
import {getArrayBuffer} from '../util/ajax';
import browser from '../util/browser';
import assert from 'assert';
import {isWorker} from '../util/util';

import type {Callback} from '../types/callback';

export const rtlPluginStatus = {
    unavailable: 'unavailable', // Not loaded
    deferred: 'deferred', // The plugin URL has been specified, but loading has been deferred
    loading: 'loading', // request in-flight
    parsing: 'parsing',
    parsed: 'parsed',
    loaded: 'loaded',
    error: 'error'
};

export type PluginStatus = typeof rtlPluginStatus[keyof typeof rtlPluginStatus];

export type PluginState = {
    pluginStatus: PluginStatus;
    pluginURL: string | null | undefined;
};

type PluginStateSyncCallback = (state: PluginState) => void;
let _completionCallback = null;

//Variables defining the current state of the plugin
let pluginStatus: PluginStatus = rtlPluginStatus.unavailable;
let pluginURL: string | null | undefined = null;

export const triggerPluginCompletionEvent = function (error?: Error | null) {
    // NetworkError's are not correctly reflected by the plugin status which prevents reloading plugin
// @ts-expect-error - TS2339 - Property 'indexOf' does not exist on type 'never'.
    if (error && typeof error === 'string' && error.indexOf('NetworkError') > -1) {
        pluginStatus = rtlPluginStatus.error;
    }

    if (_completionCallback) {
        _completionCallback(error);
    }
};

function sendPluginStateToWorker() {
    evented.fire(new Event('pluginStateChange', {pluginStatus, pluginURL}));
}

type EventRegistry = {
    'pluginStateChange': PluginState;
};

export const evented = new Evented<EventRegistry>();

export const getRTLTextPluginStatus = function (): PluginStatus {
    return pluginStatus;
};

export const registerForPluginStateChange = function (callback: PluginStateSyncCallback): PluginStateSyncCallback {
    // Do an initial sync of the state
    callback({pluginStatus, pluginURL});
    // Listen for all future state changes
    evented.on('pluginStateChange', callback);
    return callback;
};

export const clearRTLTextPlugin = function () {
    pluginStatus = rtlPluginStatus.unavailable;
    pluginURL = null;
};

export const setRTLTextPlugin = function (url: string, callback?: Callback<{
    err: Error | null | undefined;
}> | null, deferred: boolean = false) {
    if (pluginStatus === rtlPluginStatus.deferred || pluginStatus === rtlPluginStatus.loading || pluginStatus === rtlPluginStatus.loaded) {
        throw new Error('setRTLTextPlugin cannot be called multiple times.');
    }
    pluginURL = browser.resolveURL(url);
    pluginStatus = rtlPluginStatus.deferred;
    _completionCallback = callback;
    sendPluginStateToWorker();

    //Start downloading the plugin immediately if not intending to lazy-load
    if (!deferred) {
        downloadRTLTextPlugin();
    }
};

export const downloadRTLTextPlugin = function () {
    if (pluginStatus !== rtlPluginStatus.deferred || !pluginURL) {
        throw new Error('rtl-text-plugin cannot be downloaded unless a pluginURL is specified');
    }
    pluginStatus = rtlPluginStatus.loading;
    sendPluginStateToWorker();
    if (pluginURL) {
        getArrayBuffer({url: pluginURL}, (error) => {
            if (error) {
                triggerPluginCompletionEvent(error);
            } else {
                pluginStatus = rtlPluginStatus.loaded;
                sendPluginStateToWorker();
            }
        });
    }
};

export type RtlTextPlugin = {
    applyArabicShaping?: (arg1: string) => string;
    processBidirectionalText?: (arg1: string, arg2: Array<number>) => Array<string>;
    processStyledBidirectionalText?: (arg1: string, arg2: Array<number>, arg3: Array<number>) => Array<[string, Array<number>]>;
    isLoaded: () => boolean;
    isLoading: () => boolean;
    setState: (state: PluginState) => void;
    isParsing: () => boolean;
    isParsed: () => boolean;
    getPluginURL: () => string | null | undefined;
};

export const plugin: RtlTextPlugin = {
    applyArabicShaping: null,
    processBidirectionalText: null,
    processStyledBidirectionalText: null,
    isLoaded() {
        return pluginStatus === rtlPluginStatus.loaded || // Main Thread: loaded if the completion callback returned successfully
            plugin.applyArabicShaping != null; // Web-worker: loaded if the plugin functions have been compiled
    },
    isLoading() { // Main Thread Only: query the loading status, this function does not return the correct value in the worker context.
        return pluginStatus === rtlPluginStatus.loading;
    },
    setState(state: PluginState) { // Worker thread only: this tells the worker threads that the plugin is available on the Main thread
        assert(isWorker(self), 'Cannot set the state of the rtl-text-plugin when not in the web-worker context');

        pluginStatus = state.pluginStatus;
        pluginURL = state.pluginURL;
    },
    isParsing(): boolean {
        assert(isWorker(self), 'rtl-text-plugin is only parsed on the worker-threads');

        return pluginStatus === rtlPluginStatus.parsing;
    },
    isParsed(): boolean {
        assert(isWorker(self), 'rtl-text-plugin is only parsed on the worker-threads');

        return pluginStatus === rtlPluginStatus.parsed;
    },
    getPluginURL(): string | null | undefined {
        assert(isWorker(self), 'rtl-text-plugin url can only be queried from the worker threads');
        return pluginURL;
    }
};

export const lazyLoadRTLTextPlugin = function () {
    if (!plugin.isLoading() &&
        !plugin.isLoaded() &&
        getRTLTextPluginStatus() === 'deferred'
    ) {
        downloadRTLTextPlugin();
    }
};
