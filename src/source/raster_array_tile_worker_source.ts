import '../data/mrt_data';
import Pbf from 'pbf';
import {getArrayBuffer} from '../util/ajax';
import {MapboxRasterTile} from '../data/mrt/mrt.esm.js';

import type Actor from '../util/actor';
import type {Callback} from '../types/callback';
import type {ActorMessages} from '../util/actor_messages';
import type {OverscaledTileID} from './tile_id';
import type {
    WorkerSource,
    WorkerSourceTileRequest,
    WorkerSourceRasterArrayTileRequest,
    WorkerSourceRasterArrayTileCallback,
} from './worker_source';

MapboxRasterTile.setPbf(Pbf);

const MRT_DECODED_BAND_CACHE_SIZE = 30;

class RasterArrayWorkerTile {
    tileID: OverscaledTileID;
    uid: number;
    source: string;
    status: 'parsing' | 'done';

    _mrt: MapboxRasterTile;
    _isHeaderLoaded: boolean;
    _entireBuffer?: ArrayBuffer;

    abort: () => void;

    constructor(params: WorkerSourceRasterArrayTileRequest) {
        // If the tile request is partial, set the cacheSize to MRT_DECODED_BAND_CACHE_SIZE.
        // Otherwise, keep all decoded bands in memory.
        const cacheSize = params.partial ? MRT_DECODED_BAND_CACHE_SIZE : Infinity;
        this._mrt = new MapboxRasterTile(cacheSize);
        this._isHeaderLoaded = false;

        this.uid = params.uid;
        this.tileID = params.tileID;
        this.source = params.source;
    }

    parse(buffer: ArrayBuffer, callback: Callback<MapboxRasterTile>) {
        const mrt = this._mrt;
        this.status = 'parsing';
        this._entireBuffer = buffer;

        try {
            mrt.parseHeader(buffer);
            this._isHeaderLoaded = true;

            const decodingTasks = [];
            for (const layerId in mrt.layers) {
                const layer = mrt.getLayer(layerId);
                const range = layer.getDataRange(layer.getBandList());
                const task = mrt.createDecodingTask(range);

                const bufferSlice = buffer.slice(range.firstByte, range.lastByte + 1);
                const decodingTask = MapboxRasterTile.performDecoding(bufferSlice, task)
                    .then(result => task.complete(null, result))
                    .catch(error => task.complete(error, null));

                decodingTasks.push(decodingTask);
            }

            Promise.allSettled(decodingTasks)
                .then(() => callback(null, mrt))
                .catch(error => callback(error));
        } catch (error) {
            callback(error);
        }
    }
}

class RasterArrayTileWorkerSource implements WorkerSource {
    actor: Actor;
    loading: Record<number, RasterArrayWorkerTile>;
    loaded: Record<number, RasterArrayWorkerTile>;

    constructor(actor: Actor) {
        this.actor = actor;
        this.loading = {};
        this.loaded = {};
    }

    loadTile(params: WorkerSourceRasterArrayTileRequest, callback: WorkerSourceRasterArrayTileCallback) {
        const uid = params.uid;
        const requestParam = params.request;

        const workerTile = this.loading[uid] = new RasterArrayWorkerTile(params);
        const {cancel} = getArrayBuffer(requestParam, (error?: Error, buffer?: ArrayBuffer, cacheControl?: string, expires?: string) => {
            const aborted = !this.loading[uid];
            delete this.loading[uid];

            if (aborted || error || !buffer) {
                workerTile.status = 'done';
                if (!aborted) this.loaded[uid] = workerTile;
                return callback(error);
            }

            workerTile.parse(buffer, (error?: Error | null, mrt?: MapboxRasterTile) => {
                if (error || !mrt) return callback(error);
                callback(null, mrt, cacheControl, expires);
            });

            this.loaded[uid] = workerTile;
        });

        workerTile.abort = cancel;
    }

    reloadTile(params: WorkerSourceRasterArrayTileRequest, callback: WorkerSourceRasterArrayTileCallback) {
        // No-op in the RasterArrayTileWorkerSource class
        callback(null, undefined);
    }

    abortTile(params: WorkerSourceTileRequest, callback: Callback<void>) {
        const uid = params.uid;
        const workerTile = this.loading[uid];
        if (workerTile) {
            if (workerTile.abort) workerTile.abort();
            delete this.loading[uid];
        }
        callback();
    }

    removeTile(params: WorkerSourceTileRequest, callback: Callback<void>) {
        const uid = params.uid;
        if (this.loaded[uid]) {
            delete this.loaded[uid];
        }
        callback();
    }

    decodeRasterArray(params: ActorMessages['decodeRasterArray']['params'], callback: ActorMessages['decodeRasterArray']['callback']) {
        MapboxRasterTile.performDecoding(params.buffer, params.task)
            .then(result => callback(null, result))
            .catch(error => callback(error));
    }
}

export default RasterArrayTileWorkerSource;
