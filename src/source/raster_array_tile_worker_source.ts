import '../data/mrt_data';
import {MapboxRasterTile} from '../data/mrt/mrt.esm.js';
import Pbf from 'pbf';

MapboxRasterTile.setPbf(Pbf);

import type Actor from '../util/actor';
import type {WorkerRasterArrayTileParameters, WorkerRasterArrayTileCallback} from './worker_source';

class RasterArrayTileWorkerSource {
    actor: Actor;

    decodeRasterArray({
        task,
        buffer,
    }: WorkerRasterArrayTileParameters, callback: WorkerRasterArrayTileCallback) {
        MapboxRasterTile.performDecoding(buffer, task)
            .then(result => {
                callback(null, result);
            }, error => {
                callback(error);
            });
    }
}

export default RasterArrayTileWorkerSource;
