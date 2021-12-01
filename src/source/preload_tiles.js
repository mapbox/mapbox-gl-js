// @flow

import type Tile from './tile.js';
import type {CameraOptions} from '../ui/camera.js';
import type {LngLatBoundsLike} from '../geo/lng_lat_bounds.js';

/**
 * Tiles preloading progress state.
 *
 * @typedef {Object} TilesPreloadProgress
 * @property {number} completed Number of completed tiles.
 * @property {number} errored Number of errored tiles.
 * @property {number} requested Number of requested tiles.
 * @property {number} pending Number of pending tiles.
 */
export type TilesPreloadProgress = {
  completed: number,
  errored: number,
  requested: number,
  pending: number,
};

/**
 * Preloads tiles in the requested viewport.
 *
 * @param {LngLatBoundsLike} bounds Center these bounds in the viewport and use the highest
 *      zoom level up to and including `Map#getMaxZoom()` that fits them in the viewport.
 * @param {Object} [options] Options supports all properties from {@link CameraOptions}.
 * @param {Function} [callback] Called when each of the requested tiles is ready or errored.
 * @returns {number} Number of tiles to load.
 * @example
 * map.addSource('id', {
 *     type: 'vector',
 *     url: 'mapbox://mapbox.mapbox-streets-v8'
 * });
 *
 * map.getSource('id').preloadTiles(bbox, {padding: 20}, ({requested, pending, completed, errored}) => {
 *     if (pending === 0) {
 *         map.fitBounds(bbox, {duration:0});
 *     }
 * });
 */
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
