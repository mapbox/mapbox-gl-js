import DEMData from '../data/dem_data';
import {getArrayBuffer} from '../util/ajax';
import {prevPowerOfTwo} from '../util/util';

import type {TileProvider} from './tile_provider';
import type {DEMSourceEncoding} from '../data/dem_data';
import type {Cancelable} from '../../src/types/cancelable';
import type {
    WorkerSource,
    WorkerSourceOptions,
    WorkerSourceTileRequest,
    WorkerSourceDEMTileRequest,
    WorkerSourceDEMTileResult,
} from './worker_source';

class RasterDEMTileWorkerSource implements WorkerSource {
    tileProvider?: TileProvider<ArrayBuffer | ImageBitmap>;
    loading: Record<number, Cancelable>;
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

    constructor(options: WorkerSourceOptions) {
        this.tileProvider = options.tileProvider;
        this.loading = {};
    }

    async loadTile(params: WorkerSourceDEMTileRequest): Promise<WorkerSourceDEMTileResult | null> {
        const uid = params.uid;
        const controller = new AbortController();
        this.loading[uid] = {cancel: () => controller.abort()};

        if (this.tileProvider) {
            return this.loadTileWithProvider(this.tileProvider, uid, params, controller);
        }

        try {
            const {data, headers} = await getArrayBuffer(params.request, controller.signal);
            if (!data) return null;
            const result = await this.decodeTile(uid, data, params.encoding) as WorkerSourceDEMTileResult;
            result.headers = headers;
            return result;
        } catch (err) {
            if (controller.signal.aborted) return null;
            throw err;
        } finally {
            delete this.loading[uid];
        }
    }

    async decodeTile(uid: number, buffer: ArrayBuffer | ImageBitmap, encoding: DEMSourceEncoding): Promise<{dem: DEMData; borderReady: boolean}> {
        const imgBitmap = buffer instanceof ImageBitmap ?
            buffer :
            await createImageBitmap(new Blob([new Uint8Array(buffer)], {type: 'image/png'}));
        const imgBuffer = (imgBitmap.width - prevPowerOfTwo(imgBitmap.width)) / 2;
        const padding = 1 - imgBuffer;
        const borderReady = padding < 1;
        const imagePixels = this.getImageData(imgBitmap, padding);
        imgBitmap.close();

        const dem = new DEMData(uid, imagePixels, encoding, borderReady);
        return {dem, borderReady};
    }

    async loadTileWithProvider(provider: TileProvider<ArrayBuffer | ImageBitmap>, uid: number, params: WorkerSourceDEMTileRequest, controller: AbortController): Promise<WorkerSourceDEMTileResult | null> {
        const {z, x, y} = params.tileID.canonical;
        try {
            const response = await provider.loadTile({z, x, y}, {request: params.request, signal: controller.signal});

            if (controller.signal.aborted) return null;

            if (response == null) {
                const err: Error & {status?: number} = new Error('Tile not found');
                err.status = 404;
                throw err;
            }

            if (response.data == null) return null;

            const result = await this.decodeTile(uid, response.data, params.encoding) as WorkerSourceDEMTileResult;

            if (controller.signal.aborted) return null;

            const headers = new Headers();
            if (response.expires) headers.set('expires', response.expires);
            if (response.cacheControl) headers.set('cache-control', response.cacheControl);
            result.headers = headers;
            return result;
        } catch (err) {
            if (controller.signal.aborted) return null;
            throw err;
        } finally {
            delete this.loading[uid];
        }
    }

    async reloadTile(_params: WorkerSourceDEMTileRequest) {
        // No-op: DEM tiles have no persistent worker-side state to reload
    }

    abortTile(params: WorkerSourceTileRequest): void {
        const uid = params.uid;
        const tile = this.loading[uid];
        if (tile) {
            tile.cancel();
            delete this.loading[uid];
        }
    }

    removeTile(_params: WorkerSourceTileRequest): void {
        // No-op in the RasterDEMTileWorkerSource class
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
