// @flow

import DEMData from '../data/dem_data.js';
import {RGBAImage} from '../util/image.js';
import window from '../util/window.js';

import type Actor from '../util/actor.js';
import type {WorkerDEMTileParameters, WorkerDEMTileCallback} from './worker_source.js';
const {ImageBitmap} = window;

class RasterDEMTileWorkerSource {
    actor: Actor;
    offscreenCanvas: OffscreenCanvas;
    offscreenCanvasContext: CanvasRenderingContext2D;

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData, padding, buildQuadTree} = params;
        // Main thread will transfer ImageBitmap if offscreen decode with OffscreenCanvas is supported, else it will transfer an already decoded image.
        const imagePixels = (ImageBitmap && rawImageData instanceof ImageBitmap) ? this.getImageData(rawImageData, padding) : rawImageData;
        const dem = new DEMData(uid, imagePixels, encoding, padding < 1, buildQuadTree);
        callback(null, dem);
    }

    getImageData(imgBitmap: ImageBitmap, padding: number): RGBAImage {
        // Lazily initialize OffscreenCanvas
        if (!this.offscreenCanvas || !this.offscreenCanvasContext) {
            // Dem tiles are typically 256x256
            this.offscreenCanvas = new OffscreenCanvas(imgBitmap.width, imgBitmap.height);
            this.offscreenCanvasContext = this.offscreenCanvas.getContext('2d');
        }

        this.offscreenCanvas.width = imgBitmap.width;
        this.offscreenCanvas.height = imgBitmap.height;

        this.offscreenCanvasContext.drawImage(imgBitmap, 0, 0, imgBitmap.width, imgBitmap.height);
        // Insert or remove defined padding around the image to allow backfilling for neighboring data.
        const imgData = this.offscreenCanvasContext.getImageData(-padding, -padding, imgBitmap.width + 2 * padding, imgBitmap.height + 2 * padding);
        this.offscreenCanvasContext.clearRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);
        return new RGBAImage({width: imgData.width, height: imgData.height}, imgData.data);
    }
}

export default RasterDEMTileWorkerSource;
