import DEMData from '../data/dem_data';

import type Actor from '../util/actor';
import type {WorkerDEMTileParameters, WorkerDEMTileCallback} from './worker_source';

class RasterDEMTileWorkerSource {
    actor: Actor;
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: CanvasRenderingContext2D;

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData, padding} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        // Flow struggles to refine ImageBitmap type
        const imagePixels = ImageBitmap && rawImageData instanceof ImageBitmap ? this.getImageData(rawImageData, padding) : (rawImageData as ImageData);
        const dem = new DEMData(uid, imagePixels, encoding, padding < 1);
        callback(null, dem);
    }

    getImageData(imgBitmap: ImageBitmap, padding: number): ImageData {
        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            // @ts-expect-error - TS2739 - Type 'OffscreenCanvasRenderingContext2D' is missing the following properties from type 'CanvasRenderingContext2D': getContextAttributes, drawFocusIfNeeded
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
