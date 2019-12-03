// @flow

import DEMData from '../data/dem_data';
import {RGBAImage} from '../util/image';
import window from '../util/window';

import type Actor from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';
const {ImageBitmap} = window;

class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[string]: DEMData};
    offcreenCanvas: OffscreenCanvas;
    offcreenCanvasContext: CanvasRenderingContext2D;

    constructor() {
        this.loaded = {};
    }

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData} = params;

        const imagePixels = (ImageBitmap && rawImageData instanceof ImageBitmap) ? this.getImageData(rawImageData) : rawImageData;
        const dem = new DEMData(uid, imagePixels, encoding);
        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
    }

    getImageData(imgBitmap: ImageBitmap): RGBAImage {
        // Lazily initialize OffscreenCanvas
        if (!this.offcreenCanvas || !this.offcreenCanvasContext) {
            this.offcreenCanvas = new OffscreenCanvas(512, 512);
            this.offcreenCanvasContext = this.offcreenCanvas.getContext('2d');
        }

        this.offcreenCanvas.width = imgBitmap.width;
        this.offcreenCanvas.height = imgBitmap.height;
        this.offcreenCanvasContext.drawImage(imgBitmap, 0, 0, imgBitmap.width, imgBitmap.height);
        // Insert an additional 1px padding around the image to allow backfilling for neighboring data.
        const imgData = this.offcreenCanvasContext.getImageData(-1, -1, imgBitmap.width + 2, imgBitmap.height + 2);
        return new RGBAImage({width: imgData.width, height: imgData.height}, imgData.data);
    }

    removeTile(params: TileParameters) {
        const loaded = this.loaded,
            uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}

export default RasterDEMTileWorkerSource;
