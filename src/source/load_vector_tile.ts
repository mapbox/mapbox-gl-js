import {VectorTile} from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import {getArrayBuffer} from '../util/ajax';

import type {Callback} from '../types/callback';
import type {WorkerSourceVectorTileRequest} from './worker_source';
import type Scheduler from '../util/scheduler';

export type LoadVectorTileResult = {
    rawData: ArrayBuffer;
    vectorTile?: VectorTile;
    resourceTiming?: Array<PerformanceResourceTiming>;
    responseHeaders?: Map<string, string>
};

/**
 * @callback LoadVectorDataCallback
 * @param error
 * @param vectorTile
 * @private
 */
export type LoadVectorDataCallback = Callback<LoadVectorTileResult | null | undefined>;

export type AbortVectorData = () => void;
export type LoadVectorData = (params: WorkerSourceVectorTileRequest, callback: LoadVectorDataCallback) => AbortVectorData | undefined;
export class DedupedRequest {
    entries: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    };
    scheduler: Scheduler | null | undefined;

    constructor(scheduler?: Scheduler) {
        this.entries = {};
        this.scheduler = scheduler;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request(key: string, metadata: any, request: any, callback: LoadVectorDataCallback): () => void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const entry = this.entries[key] = this.entries[key] || {callbacks: []};

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (entry.result) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const [err, result] = entry.result;
            if (this.scheduler) {
                this.scheduler.add(() => {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                    callback(err, result);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                }, metadata);
            } else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                callback(err, result);
            }
            return () => {};
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        entry.callbacks.push(callback);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!entry.cancel) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            entry.cancel = request((err, result) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                entry.result = [err, result];
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                for (const cb of entry.callbacks) {
                    if (this.scheduler) {
                        this.scheduler.add(() => {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                            cb(err, result);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        }, metadata);
                    } else {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                        cb(err, result);
                    }
                }
                setTimeout(() => delete this.entries[key], 1000 * 3);
            });
        }

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (entry.result) return;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            entry.callbacks = entry.callbacks.filter(cb => cb !== callback);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (!entry.callbacks.length) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
    params: WorkerSourceVectorTileRequest,
    callback: LoadVectorDataCallback,
    skipParse?: boolean,
): () => void {
    const key = JSON.stringify(params.request);

    const makeRequest = (callback: LoadVectorDataCallback) => {
        const request = getArrayBuffer(params.request, (err?: Error | null, data?: ArrayBuffer | null, responseHeaders?: Headers) => {
            if (err) {
                callback(err);
            } else if (data) {
                callback(null, {
                    vectorTile: skipParse ? undefined : new VectorTile(new Protobuf(data)),
                    rawData: data,
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (this.deduped as DedupedRequest).entries[key] = {result: [null, params.data]};
    }

    const callbackMetadata = {type: 'parseTile', isSymbolTile: params.isSymbolTile, zoom: params.tileZoom};
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return (this.deduped as DedupedRequest).request(key, callbackMetadata, makeRequest, callback);
}
