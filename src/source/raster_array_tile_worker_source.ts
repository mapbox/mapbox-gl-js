import '../data/mrt_data';
import {PbfReader} from 'pbf';
import {getArrayBuffer} from '../util/ajax';
import {MapboxRasterTile} from '../data/mrt/mrt.esm.js';

import type {WorkerInbox} from '../util/actor_messages';
import type {OverscaledTileID} from './tile_id';
import type {
    WorkerSource,
    WorkerSourceOptions,
    WorkerSourceTileRequest,
    WorkerSourceRasterArrayTileRequest,
    WorkerSourceActor,
} from './worker_source';

MapboxRasterTile.setPbf(PbfReader);

export type RasterArrayTileLoadResult = {
    mrt: MapboxRasterTile;
    headers: Headers;
};

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

    async parse(buffer: ArrayBuffer): Promise<MapboxRasterTile> {
        const mrt = this._mrt;
        this.status = 'parsing';
        this._entireBuffer = buffer;

        mrt.parseHeader(buffer);
        this._isHeaderLoaded = true;

        const decodingTasks = [];
        for (const layerId in mrt.layers) {
            const layer = mrt.getLayer(layerId);
            const range = layer.getDataRange(layer.getBandList());
            const task = mrt.createDecodingTask(range);

            const bufferSlice = buffer.slice(range.firstByte, range.lastByte + 1);
            decodingTasks.push(
                MapboxRasterTile.performDecoding(bufferSlice, task)
                    .then(result => task.complete(null, result))
                    .catch((error: Error) => task.complete(error, null))
            );
        }

        await Promise.allSettled(decodingTasks);
        return mrt;
    }
}

class RasterArrayTileWorkerSource implements WorkerSource {
    actor: WorkerSourceActor;
    loading: Record<number, RasterArrayWorkerTile>;
    loaded: Record<number, RasterArrayWorkerTile>;

    constructor({actor}: WorkerSourceOptions) {
        this.actor = actor;
        this.loading = {};
        this.loaded = {};
    }

    async loadTile(params: WorkerSourceRasterArrayTileRequest): Promise<RasterArrayTileLoadResult | null | undefined> {
        const uid = params.uid;
        const controller = new AbortController();
        const workerTile = this.loading[uid] = new RasterArrayWorkerTile(params);
        workerTile.abort = () => controller.abort();

        try {
            const {data, headers} = await getArrayBuffer(params.request, controller.signal);
            if (!data) {
                workerTile.status = 'done';
                this.loaded[uid] = workerTile;
                return null;
            }
            this.loaded[uid] = workerTile;
            const mrt = await workerTile.parse(data);
            return {mrt, headers};
        } catch (err) {
            if (controller.signal.aborted) return null;
            workerTile.status = 'done';
            this.loaded[uid] = workerTile;
            throw err;
        } finally {
            delete this.loading[uid];
        }
    }

    async reloadTile(_params: WorkerSourceRasterArrayTileRequest) {
        // No-op in the RasterArrayTileWorkerSource class
    }

    abortTile(params: WorkerSourceTileRequest): void {
        const uid = params.uid;
        const workerTile = this.loading[uid];
        if (workerTile) {
            if (workerTile.abort) workerTile.abort();
            delete this.loading[uid];
        }
    }

    removeTile(params: WorkerSourceTileRequest): void {
        const uid = params.uid;
        if (this.loaded[uid]) {
            delete this.loaded[uid];
        }
    }

    async decodeRasterArray(params: WorkerInbox['decodeRasterArray']['params']): Promise<WorkerInbox['decodeRasterArray']['result']> {
        return MapboxRasterTile.performDecoding(params.buffer, params.task);
    }
}

export default RasterArrayTileWorkerSource;
