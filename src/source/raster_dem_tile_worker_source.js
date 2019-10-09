// @flow

import DEMData from '../data/dem_data';

import type Actor from '../util/actor';
import type {
    WorkerDEMTileParameters,
    WorkerDEMTileCallback,
    TileParameters
} from './worker_source';

class RasterDEMTileWorkerSource {
    actor: Actor;
    loaded: {[string]: DEMData};
    offcreenCanvas: ?OffscreenCanvas;

    constructor() {
        this.loaded = {};
        this.offcreenCanvas = new OffscreenCanvas(512, 512);
        this.offcreenCanvasContext = this.offcreenCanvas.getContext('2d');
    }

    loadTile(params: WorkerDEMTileParameters, callback: WorkerDEMTileCallback) {
        const {uid, encoding, rawImageData} = params;
        let imagePixels = rawImageData;
        if (true) {
            this.offcreenCanvas.width = rawImageData.width;
            this.offcreenCanvas.height = rawImageData.height;
            this.offcreenCanvasContext.drawImage(rawImageData, 0, 0, rawImageData.width, rawImageData.height);
            imagePixels = this.offcreenCanvasContext.getImageData(-1, -1, rawImageData.width + 2, rawImageData.height + 2);
        }

        const dem = new DEMData(uid, imagePixels, encoding);

        this.loaded = this.loaded || {};
        this.loaded[uid] = dem;
        callback(null, dem);
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
