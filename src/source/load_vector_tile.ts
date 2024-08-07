import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {getArrayBuffer} from '../util/ajax';
import assert from "assert";

import type {Callback} from '../types/callback';
import type {RequestedTileParameters} from './worker_source';
import type Scheduler from '../util/scheduler';
import type {Cancelable} from 'src/types/cancelable';

export type LoadVectorTileResult = {
    rawData: ArrayBuffer;
    vectorTile?: VectorTile;
    expires?: any;
    cacheControl?: any;
    resourceTiming?: Array<PerformanceResourceTiming>;
};

/**
 * @callback LoadVectorDataCallback
 * @param error
 * @param vectorTile
 * @private
 */
export type LoadVectorDataCallback = Callback<LoadVectorTileResult | null | undefined>;

export type AbortVectorData = () => void;
export type LoadVectorData = (params: RequestedTileParameters, callback: LoadVectorDataCallback, deduped: DedupedRequest) => AbortVectorData | null | undefined;
export type DedupedRequestInput = {key : string,
    metadata: any,
    requestFunc: any,
    callback: LoadVectorDataCallback,
    fromQueue?: boolean
};
export type VectorTileQueueEntry = DedupedRequestInput & {
    cancelled: boolean,
    cancel: () => void
};

let requestQueue: Map<string, VectorTileQueueEntry>, numRequests: number;
export const resetRequestQueue = () => {
    requestQueue = new Map();
    numRequests = 0;
};
resetRequestQueue();

const filterQueue = (key: string) => {
    requestQueue.delete(key);
};

export class DedupedRequest {
    entries: {
        [key: string]: any;
    };
    scheduler: Scheduler | null | undefined;

    constructor(scheduler?: Scheduler) {
        this.entries = {};
        this.scheduler = scheduler;
    }

    addToSchedulerOrCallDirectly({
        callback,
        metadata,
        err,
        result,
    }: {
        callback: LoadVectorDataCallback;
        metadata: any;
        err: Error | null | undefined;
        result: any;
    }) {
        if (this.scheduler) {
            this.scheduler.add(() => {
                callback(err, result);
            }, metadata);
        } else {
            callback(err, result);
        }
    }

    getEntry = (key: string) => {
        return (
            this.entries[key] || {
                // use a set to avoid duplicate callbacks being added when calling from queue
                callbacks: new Set(),
            }
        );
    };

    request({key, metadata, requestFunc, callback, fromQueue}: DedupedRequestInput): Cancelable {
        const entry = (this.entries[key] = this.getEntry(key));

        const removeCallbackFromEntry = ({key, requestCallback}) => {
            const entry = this.getEntry(key);
            if (entry.result) {
                return;
            }
            entry.callbacks.delete(requestCallback);
            if (entry.callbacks.size) {
                return;
            }
            if (entry.cancel) {
                entry.cancel();
            }
            filterQueue(key);
            delete this.entries[key];
        };

        let advanced = false;
        const advanceRequestQueue = () => {
            if (advanced) {
                return;
            }
            advanced = true;
            numRequests--;
            assert(numRequests >= 0);
            while (requestQueue.size && numRequests < 50) {
                const request = requestQueue.values().next().value;
                const {key, metadata, requestFunc, callback, cancelled} = request;
                filterQueue(key);
                if (!cancelled) {
                    request.cancel = this.request({
                        key,
                        metadata,
                        requestFunc,
                        callback,
                        fromQueue: true
                    }).cancel;
                }
            }
        };

        if (entry.result) {
            const [err, result] = entry.result;
            this.addToSchedulerOrCallDirectly({
                callback,
                metadata,
                err,
                result,
            });
            return {cancel: () => {}};
        }

        entry.callbacks.add(callback);

        const inQueue = requestQueue.has(key);
        if ((!entry.cancel && !inQueue) || fromQueue) {
            // Lack of attached cancel handler means this is the first request for this resource
            if (numRequests >= 50) {
                const queued = {
                    key,
                    metadata,
                    requestFunc,
                    callback,
                    cancelled: false,
                    cancel() {},
                };
                const cancelFunc = () => {
                    queued.cancelled = true;
                    removeCallbackFromEntry({
                        key,
                        requestCallback: callback,
                    });
                };
                queued.cancel = cancelFunc;
                requestQueue.set(key, queued);
                return queued;
            }
            numRequests++;

            const actualRequestCancel = requestFunc((err, result) => {
                entry.result = [err, result];

                for (const cb of entry.callbacks) {
                    this.addToSchedulerOrCallDirectly({
                        callback: cb,
                        metadata,
                        err,
                        result,
                    });
                }

                filterQueue(key);
                advanceRequestQueue();

                setTimeout(() => {
                    delete this.entries[key];
                }, 1000 * 3);
            });
            entry.cancel = actualRequestCancel;
        }

        return {
            cancel() {
                removeCallbackFromEntry({
                    key,
                    requestCallback: callback,
                });
            },
        };
    }
}

const makeArrayBufferHandler = ({requestParams, skipParse}) => {

    const makeRequest = (callback: LoadVectorDataCallback) => {
        const request = getArrayBuffer(requestParams, (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
            if (err) {
                callback(err);
            } else if (data) {
                callback(null, {
                    vectorTile: skipParse ? undefined : new VectorTile(new Protobuf(data)),
                    rawData: data,
                    cacheControl,
                    expires
                });
            }
        });
        return () => {
            request.cancel();
            callback();
        };
    };

    return makeRequest;
};

/**
 * @private
 */
export function loadVectorTile(
    params: RequestedTileParameters,
    callback: LoadVectorDataCallback,
    deduped: DedupedRequest,
    skipParse?: boolean,
    providedArrayBufferHandlerMaker?: any
): () => void {
    const key = JSON.stringify(params.request);

    const arrayBufferCallbackMaker = providedArrayBufferHandlerMaker || makeArrayBufferHandler;
    const makeRequest = arrayBufferCallbackMaker({requestParams: params.request, skipParse});

    if (params.data) {
        // if we already got the result earlier (on the main thread), return it directly
        deduped.entries[key] = {result: [null, params.data]};
    }

    const callbackMetadata = {type: 'parseTile', isSymbolTile: params.isSymbolTile, zoom: params.tileZoom};
    const dedupedAndQueuedRequest = deduped.request({
        key,
        metadata: callbackMetadata,
        requestFunc: makeRequest,
        callback,
        fromQueue: false
    });

    return dedupedAndQueuedRequest.cancel;
}
