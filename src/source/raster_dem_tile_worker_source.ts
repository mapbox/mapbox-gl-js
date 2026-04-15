import DEMData from '../data/dem_data';
import {getArrayBuffer} from '../util/ajax';
import {getExpiryDataFromHeaders, prevPowerOfTwo} from '../util/util';

import type {TileProvider} from './tile_provider';
import type {DEMSourceEncoding} from '../data/dem_data';
import type {Cancelable} from '../../src/types/cancelable';
import type {
    WorkerSource,
    WorkerSourceOptions,
    WorkerSourceTileRequest,
    WorkerSourceDEMTileRequest,
    WorkerSourceDEMTileCallback,
    WorkerSourceVectorTileCallback
} from './worker_source';

class RasterDEMTileWorkerSource implements WorkerSource {
    tileProvider?: TileProvider<ArrayBuffer>;
    loading: Record<number, Cancelable>;
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

    constructor(options: WorkerSourceOptions) {
        this.tileProvider = options.tileProvider;
        this.loading = {};
    }

    loadTile(params: WorkerSourceDEMTileRequest, callback: WorkerSourceDEMTileCallback) {
        const uid = params.uid;

        if (this.tileProvider) {
            const controller = new AbortController();
            this.loading[uid] = {cancel: () => controller.abort()};
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.loadTileWithProvider(this.tileProvider, uid, params, controller, callback);
            return;
        }

        const {cancel} = getArrayBuffer(params.request, (err?: Error | null, buffer?: ArrayBuffer | null, headers?: Headers) => {
            const aborted = !this.loading[uid];
            delete this.loading[uid];

            if (aborted || err || !buffer) {
                return callback(err);
            }

            this.decodeTile(uid, buffer, params.encoding)
                .then((result) => {
                    const {expires, cacheControl} = getExpiryDataFromHeaders(headers);
                    callback(null, Object.assign(result, {expires, cacheControl}));
                })
                .catch((e: Error) => callback(e));
        });

        this.loading[uid] = {cancel};
    }

    async decodeTile(uid: number, buffer: ArrayBuffer, encoding: DEMSourceEncoding): Promise<{dem: DEMData; borderReady: boolean}> {
        const imgBitmap = await createImageBitmap(new Blob([new Uint8Array(buffer)], {type: 'image/png'}));
        const imgBuffer = (imgBitmap.width - prevPowerOfTwo(imgBitmap.width)) / 2;
        const padding = 1 - imgBuffer;
        const borderReady = padding < 1;
        const imagePixels = this.getImageData(imgBitmap, padding);
        imgBitmap.close();

        const dem = new DEMData(uid, imagePixels, encoding, borderReady);
        return {dem, borderReady};
    }

    async loadTileWithProvider(provider: TileProvider<ArrayBuffer>, uid: number, params: WorkerSourceDEMTileRequest, controller: AbortController, callback: WorkerSourceDEMTileCallback) {
        const {z, x, y} = params.tileID.canonical;
        try {
            const response = await provider.loadTile({z, x, y}, {request: params.request, signal: controller.signal});

            if (controller.signal.aborted) return callback(null, null);

            if (response == null) {
                const err: Error & {status?: number} = new Error('Tile not found');
                err.status = 404;
                return callback(err);
            }

            if (response.data == null) return callback(null, null);

            const result = await this.decodeTile(uid, response.data, params.encoding);

            if (controller.signal.aborted) return callback(null, null);

            callback(null, Object.assign(result, {
                expires: response.expires,
                cacheControl: response.cacheControl,
            }));
        } catch (err) {
            if (controller.signal.aborted) return callback(null, null);
            if (err instanceof DOMException && err.name === 'AbortError') return callback(null, null);
            // eslint-disable-next-line @typescript-eslint/no-base-to-string
            callback(err instanceof Error ? err : new Error(String(err)));
        } finally {
            delete this.loading[uid];
        }
    }

    reloadTile(params: WorkerSourceDEMTileRequest, callback: WorkerSourceDEMTileCallback) {
        // No-op: DEM tiles have no persistent worker-side state to reload
        callback(null, null);
    }

    abortTile(params: WorkerSourceTileRequest, callback: WorkerSourceVectorTileCallback) {
        const uid = params.uid;
        const tile = this.loading[uid];
        if (tile) {
            tile.cancel();
            delete this.loading[uid];
        }
        callback();
    }

    removeTile(params: WorkerSourceTileRequest, callback: WorkerSourceVectorTileCallback) {
        // No-op in the RasterDEMTileWorkerSource class
        callback();
    }

    getImageData(imgBitmap: ImageBitmap, padding: number): ImageData {
        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            this.offscreenCanvasContext = this.offscreenCanvas.getContext('2d', {willReadFrequently: true});
        }

        this.offscreenCanvas.width = imgBitmap.width;
        this.offscreenCanvas.height = imgBitmap.height;

        this.offscreenCanvasContext.drawImage(imgBitmap, 0, 0, imgBitmap.width, imgBitmap.height);
        // Insert or remove defined padding around the image to allow backfilling for neighboring data.
        const imgData = this.offscreenCanvasContext.getImageData(-padding, -padding, imgBitmap.width + 2 * padding, imgBitmap.height + 2 * padding);
        this.offscreenCanvasContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        return imgData;
    }
}

export default RasterDEMTileWorkerSource;
