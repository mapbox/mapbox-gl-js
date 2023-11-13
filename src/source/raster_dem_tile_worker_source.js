// @flow

import DEMData from '../data/dem_data.js';
import window from '../util/window.js';

import type Actor from '../util/actor.js';
import type {WorkerDEMTileParameters, WorkerDEMTileCallback} from './worker_source.js';

class RasterDEMTileWorkerSource {
    actor: Actor;
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: CanvasRenderingContext2D;

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData, padding} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        // Flow struggles to refine ImageBitmap type, likely due to the JSDom shim
        const imagePixels = window.ImageBitmap && rawImageData instanceof window.ImageBitmap ? this.getImageData(rawImageData, padding) : ((rawImageData: any): ImageData);
        const dem = new DEMData(uid, imagePixels, encoding, params.convertToFloat, padding < 1);
        callback(null, dem);
    }

    getImageData(imgBitmap: ImageBitmap, padding: number): ImageData {
        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            // $FlowIssue[extra-arg]: internal Flow types don't yet know about willReadFrequently
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
