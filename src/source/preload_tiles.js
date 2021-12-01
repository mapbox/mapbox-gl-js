// @flow

import type Tile from './tile.js';
import type {CameraOptions} from '../ui/camera.js';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.js';
import type {TilesPreloadProgress} from './source_cache.js';

export const preloadTiles = function(bounds: LngLatBoundsLike, options?: CameraOptions, callback?: (progress: TilesPreloadProgress) => void): number {
    const progress = {
        errored: 0,
        completed: 0,
        pending: 0,
        requested: 0,
    };

    function tileLoaded(err: ?Error, _: ?Tile) {
        if (err) progress.errored++;
        else progress.completed++;
        progress.pending = progress.requested - (progress.errored + progress.completed);

        // $FlowFixMe
        callback(progress);
    }

    const sourceCaches = this.map.style._getSourceCaches(this.id);
    for (const sourceCache of sourceCaches) {
        progress.requested += sourceCache.preloadTiles(bounds, options, callback ? tileLoaded : undefined);
    }

    return progress.requested;
};
