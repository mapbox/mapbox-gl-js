// @flow

import '../data/mrt_data.js';
import {MapboxRasterTile} from '../data/mrt/mrt.js';

import type Actor from '../util/actor.js';
import type {WorkerRasterArrayTileParameters, WorkerRasterArrayTileCallback} from './worker_source.js';

class RasterArrayTileWorkerSource {
    actor: Actor;

    decodeRasterArray({task, buffer}: WorkerRasterArrayTileParameters, callback: WorkerRasterArrayTileCallback) {
        MapboxRasterTile.performDecoding(buffer, task)
            .then(result => {
                callback(null, result);
            }, error => {
                callback(error);
            });
    }
}

export default RasterArrayTileWorkerSource;
