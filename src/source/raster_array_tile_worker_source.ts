import '../data/mrt_data';
import Pbf from 'pbf';
import {MapboxRasterTile} from '../data/mrt/mrt.esm.js';

import type Actor from '../util/actor';
import type {WorkerRasterArrayDecodingParameters, WorkerRasterArrayDecodingCallback} from './worker_source';

MapboxRasterTile.setPbf(Pbf);

class RasterArrayTileWorkerSource {
    actor: Actor;

    decodeRasterArray({task, buffer}: WorkerRasterArrayDecodingParameters, callback: WorkerRasterArrayDecodingCallback) {
        MapboxRasterTile.performDecoding(buffer, task)
            .then(result => {
                callback(null, result);
            }, error => {
                callback(error);
            });
    }
}

export default RasterArrayTileWorkerSource;
