// @ts-expect-error - TS2300 - Duplicate identifier 'VectorTile'.
import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {getArrayBuffer} from '../util/ajax';
import assert from "assert";

// @ts-expect-error - TS2300 - Duplicate identifier 'VectorTile'.
import type {VectorTile} from '@mapbox/vector-tile';
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
export type LoadVectorData = (params: RequestedTileParameters, callback: LoadVectorDataCallback) => AbortVectorData | null | undefined;
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

let requestQueue: VectorTileQueueEntry[], numRequests: number;
const resetRequestQueue = () => {
    requestQueue = [];
    numRequests = 0;
};
resetRequestQueue();

const filterQueue = (key: string) => {
    for (let i = requestQueue.length - 1; i >= 0; i--) {
        if (requestQueue[i].key === key) {
            requestQueue.splice(i, 1);
        }
    }
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
            if (entry.result) return;
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
        const advanceImageRequestQueue = () => {
            if (advanced) {
                return;
            }
            advanced = true;
            numRequests--;
            assert(numRequests >= 0);
            while (requestQueue.length && numRequests < 50) {
                const request = requestQueue.shift();
                const {key, metadata, requestFunc, callback, cancelled} = request;
                if (!cancelled) {
                    request.cancel = this.request({
                        key,
                        metadata,
                        requestFunc,
                        callback,
                        fromQueue: true
                    }).cancel;
                } else {
                    filterQueue(key);
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

        const inQueue = requestQueue.some((queued) => queued.key === key);
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
                requestQueue.push(queued);
                return queued;
            }
            numRequests++;

            const actualRequestCancel = requestFunc((err, result) => {
                entry.result = [err, result];

                // Notable difference here compared to previous deduper, no longer iterating through callbacks stored on the entry
                // Due to intermittent errors thrown when duplicate arrayBuffers get added to the scheduling
                this.addToSchedulerOrCallDirectly({
                    callback,
                    metadata,
                    err,
                    result,
                });

                filterQueue(key);
                advanceImageRequestQueue();

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

/**
 * @private
 */
export function loadVectorTile(
    params: RequestedTileParameters,
    callback: LoadVectorDataCallback,
    skipParse?: boolean,
): () => void {
    const key = JSON.stringify(params.request);

    const makeRequest = (callback: LoadVectorDataCallback) => {
        const request = getArrayBuffer(params.request, (err?: Error | null, data?: ArrayBuffer | null, cacheControl?: string | null, expires?: string | null) => {
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

    if (params.data) {
        // if we already got the result earlier (on the main thread), return it directly
        (this.deduped as DedupedRequest).entries[key] = {result: [null, params.data]};
    }

    const callbackMetadata = {type: 'parseTile', isSymbolTile: params.isSymbolTile, zoom: params.tileZoom};
    const dedupedAndQueuedRequest = (this.deduped as DedupedRequest).request({
        key,
        metadata: callbackMetadata,
        requestFunc: makeRequest,
        callback,
        fromQueue: false
    });

    return dedupedAndQueuedRequest.cancel;
}
