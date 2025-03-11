import DEMData from '../data/dem_data';

import type Actor from '../util/actor';
import type {
    WorkerSource,
    WorkerSourceTileRequest,
    WorkerSourceVectorTileCallback,
    WorkerSourceDEMTileRequest,
    WorkerSourceDEMTileCallback
} from './worker_source';

class RasterDEMTileWorkerSource implements WorkerSource {
    actor: Actor;
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: OffscreenCanvasRenderingContext2D;

    loadTile(params: WorkerSourceDEMTileRequest, callback: WorkerSourceDEMTileCallback) {
        const {uid, encoding, rawImageData, padding} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        // Flow struggles to refine ImageBitmap type
        const imagePixels = ImageBitmap && rawImageData instanceof ImageBitmap ? this.getImageData(rawImageData, padding) : (rawImageData as ImageData);
        const dem = new DEMData(uid, imagePixels, encoding, padding < 1);
        callback(null, dem);
    }

    reloadTile(params: WorkerSourceDEMTileRequest, callback: WorkerSourceDEMTileCallback) {
        // No-op in the RasterDEMTileWorkerSource class
        callback(null, null);
    }

    abortTile(params: WorkerSourceTileRequest, callback: WorkerSourceVectorTileCallback) {
        // No-op in the RasterDEMTileWorkerSource class
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
