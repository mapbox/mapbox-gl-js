// @ts-expect-error - TS2300 - Duplicate identifier 'VectorTile'.
import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {getArrayBuffer} from '../util/ajax';

// @ts-expect-error - TS2300 - Duplicate identifier 'VectorTile'.
import type {VectorTile} from '@mapbox/vector-tile';
import type {Callback} from '../types/callback';
import type {RequestedTileParameters} from './worker_source';
import type Scheduler from '../util/scheduler';

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
export class DedupedRequest {
    entries: {
        [key: string]: any;
    };
    scheduler: Scheduler | null | undefined;

    constructor(scheduler?: Scheduler) {
        this.entries = {};
        this.scheduler = scheduler;
    }

    request(key: string, metadata: any, request: any, callback: LoadVectorDataCallback): () => void {
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
            entry.cancel = request((err, result) => {
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
    return (this.deduped as DedupedRequest).request(key, callbackMetadata, makeRequest, callback);
}
