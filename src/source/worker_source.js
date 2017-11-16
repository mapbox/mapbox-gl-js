// @flow

import type {Serialized} from '../util/web_worker_transfer';
import type {RequestParameters} from '../util/ajax';
import type {RGBAImage, AlphaImage} from '../util/image';
import type {Transferable} from '../types/transferable';

export type TileParameters = {
    source: string,
    uid: string,
};

export type WorkerTileParameters = TileParameters & {
    tileID: { overscaledZ: number, wrap: number, canonical: { z: number, x: number, y: number } },
    request: RequestParameters,
    zoom: number,
    maxZoom: number,
    tileSize: number,
    pixelRatio: number,
    overscaling: number,
    showCollisionBoxes: boolean
};

export type WorkerDEMTileParameters = TileParameters & {
    coord: { z: number, x: number, y: number, w: number },
    rawImageData: RGBAImage
};

export type WorkerTileResult = {
    buckets: Array<Serialized>,
    iconAtlasImage: RGBAImage,
    glyphAtlasImage: AlphaImage,
    featureIndex: Serialized,
    collisionBoxArray: Serialized,
    rawTileData?: ArrayBuffer,
};

export type WorkerTileCallback = (error: ?Error, result: ?WorkerTileResult, transferables: ?Array<Transferable>) => void;
export type WorkerDEMTileCallback = (err: ?Error, result: ?Serialized, transferrables: ?Array<Transferable>) => void;

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
    // Disabled due to https://github.com/facebook/flow/issues/5208
    // constructor(actor: Actor, layerIndex: StyleLayerIndex): WorkerSource;

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering.  Should call the callback with:
     * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
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
    abortTile(params: TileParameters, callback: WorkerTileCallback): void;

    /**
     * Removes this tile from any local caches.
     */
    removeTile(params: TileParameters, callback: WorkerTileCallback): void;

    removeSource?: (params: {source: string}, callback: WorkerTileCallback) => void;
}
