import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {getArrayBuffer} from '../util/ajax';

import type {Callback} from '../types/callback';
import type {WorkerSourceVectorTileRequest} from './worker_source';
import type {default as Scheduler, TaskMetadata} from '../util/scheduler';

export type LoadVectorTileResult = {
    rawData: ArrayBuffer;
    vectorTile?: VectorTile;
    responseHeaders?: Map<string, string>;
};

/**
 * @callback LoadVectorDataCallback
 * @param error
 * @param vectorTile
 * @private
 */
export type LoadVectorDataCallback = Callback<LoadVectorTileResult | null | undefined>;

export type LoadVectorData = (params: WorkerSourceVectorTileRequest, callback: LoadVectorDataCallback) => AbortVectorDataRequest | undefined;

type VectorDataRequest = (callback: LoadVectorDataCallback) => AbortVectorDataRequest;
type AbortVectorDataRequest = () => void;

type DedupedRequestEntry = {
    result?: [Error | null, LoadVectorTileResult];
    cancel?: AbortVectorDataRequest;
    callbacks?: LoadVectorDataCallback[];
};

export class DedupedRequest {
    scheduler?: Scheduler;
    entries: {[key: string]: DedupedRequestEntry;};

    constructor(scheduler?: Scheduler) {
        this.entries = {};
        this.scheduler = scheduler;
    }

    request(key: string, metadata: TaskMetadata, request: VectorDataRequest, callback: LoadVectorDataCallback): AbortVectorDataRequest {
        const entry = this.entries[key] = this.entries[key] || {callbacks: []};

        if (entry.result) {
            const [err, result] = entry.result;
            if (this.scheduler) {
                this.scheduler.add(() => {
                    callback(err, result);
                }, metadata);
            } else {
                callback(err, result);
            }
            return () => {};
        }

        entry.callbacks.push(callback);

        if (!entry.cancel) {
            entry.cancel = request((err: Error, result: LoadVectorTileResult) => {
                entry.result = [err, result];
                for (const cb of entry.callbacks) {
                    if (this.scheduler) {
                        this.scheduler.add(() => {
                            cb(err, result);
                        }, metadata);
                    } else {
                        cb(err, result);
                    }
                }
                setTimeout(() => delete this.entries[key], 1000 * 3);
            });
        }

        return () => {
            if (entry.result) return;
            entry.callbacks = entry.callbacks.filter(cb => cb !== callback);
            if (!entry.callbacks.length) {
                entry.cancel();
                delete this.entries[key];
            }
        };
    }
}

/**
 * @private
 */
export function loadVectorTile(
    this: {deduped: DedupedRequest},
    params: WorkerSourceVectorTileRequest,
    callback: LoadVectorDataCallback,
    skipParse?: boolean,
): AbortVectorDataRequest {
    const key = JSON.stringify(params.request);

    const makeRequest: VectorDataRequest = (callback: LoadVectorDataCallback) => {
        const request = getArrayBuffer(params.request, (err?: Error | null, data?: ArrayBuffer | null, responseHeaders?: Headers) => {
            if (err) {
                callback(err);
            } else if (data) {
                callback(null, {
                    rawData: data,
                    vectorTile: skipParse ? undefined : new VectorTile(new Protobuf(data)),
                    responseHeaders: new Map(responseHeaders.entries())
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
        this.deduped.entries[key] = {result: [null, params.data]};
    }

    const callbackMetadata: TaskMetadata = {type: 'parseTile', isSymbolTile: params.isSymbolTile, zoom: params.tileZoom};
    return this.deduped.request(key, callbackMetadata, makeRequest, callback);
}
