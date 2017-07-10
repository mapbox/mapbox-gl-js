// @flow

import type TileCoord from './tile_coord';
import type {Actor} from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';
import type {SerializedBucket} from '../data/bucket';
import type {SerializedFeatureIndex} from '../data/feature_index';
import type {SerializedCollisionTile} from '../symbol/collision_tile';
import type {SerializedStructArray} from '../util/struct_array';

export type TileParameters = {
    source: string,
    uid: string,
};

export type PlacementConfig = {
    angle: number,
    pitch: number,
    cameraToCenterDistance: number,
    cameraToTileDistance: number,
    showCollisionBoxes: boolean,
};

export type WorkerTileParameters = TileParameters & {
    coord: TileCoord,
    url: string,
    zoom: number,
    maxZoom: number,
    tileSize: number,
    overscaling: number,
} & PlacementConfig;

export type WorkerTileResult = {
    buckets: Array<SerializedBucket>,
    featureIndex: SerializedFeatureIndex,
    collisionTile: SerializedCollisionTile,
    collisionBoxArray: SerializedStructArray,
    rawTileData?: ArrayBuffer,
};

export type WorkerTileCallback = (error: ?Error, result: ?WorkerTileResult, transferables: ?Array<Transferable>) => void;

export type RedoPlacementParameters = TileParameters & PlacementConfig;

export type RedoPlacementResult = {
    buckets: Array<SerializedBucket>,
    collisionTile: SerializedCollisionTile
};

export type RedoPlacementCallback = (error: ?Error, result: ?RedoPlacementResult, transferables: ?Array<Transferable>) => void;

/**
 * May be implemented by custom source types to provide code that can be run on
 * the WebWorkers. In addition to providing a custom
 * {@link WorkerSource#loadTile}, any other methods attached to a `WorkerSource`
 * implementation may also be targeted by the {@link Source} via
 * `dispatcher.send('source-type.methodname', params, callback)`.
 *
 * @see {@link Map#addSourceType}
 * @private
 *
 * @class WorkerSource
 * @param actor
 * @param layerIndex
 */
export interface WorkerSource {
    constructor(actor: Actor, layerIndex: StyleLayerIndex): WorkerSource;

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering.  Should call the callback with:
     * `{ buckets, featureIndex, collisionTile, rawTileData}`.
     */
    loadTile(params: WorkerTileParameters, callback: WorkerTileCallback): void;

    /**
     * Re-parses a tile that has already been loaded.  Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    reloadTile(params: WorkerTileParameters, callback: WorkerTileCallback): void;

    /**
     * Aborts loading a tile that is in progress.
     */
    abortTile(params: TileParameters): void;

    /**
     * Removes this tile from any local caches.
     */
    removeTile(params: TileParameters): void;

    redoPlacement(params: RedoPlacementParameters, callback: RedoPlacementCallback): void;
    removeSource?: (params: {source: string}) => void;
}
