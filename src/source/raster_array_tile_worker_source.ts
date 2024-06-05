import '../data/mrt_data';
import {MapboxRasterTile} from '../data/mrt/mrt';

import type Actor from '../util/actor';
import type {WorkerRasterArrayTileParameters, WorkerRasterArrayTileCallback} from './worker_source';

class RasterArrayTileWorkerSource {
    actor: Actor;

    decodeRasterArray({
        task,
        buffer,
    }: WorkerRasterArrayTileParameters, callback: WorkerRasterArrayTileCallback) {
        // @ts-expect-error - TS2339 - Property 'performDecoding' does not exist on type 'typeof MapboxRasterTile'.
        MapboxRasterTile.performDecoding(buffer, task)
            .then(result => {
                callback(null, result);
            }, error => {
                callback(error);
            });
    }
}

export default RasterArrayTileWorkerSource;
