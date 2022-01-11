// @flow

import type {RequestParameters} from '../util/ajax.js';
import type {RGBAImage, AlphaImage} from '../util/image.js';
import type {GlyphPositions} from '../render/glyph_atlas.js';
import type ImageAtlas from '../render/image_atlas.js';
import type LineAtlas from '../render/line_atlas.js';
import type {OverscaledTileID} from './tile_id.js';
import type {Bucket} from '../data/bucket.js';
import type FeatureIndex from '../data/feature_index.js';
import type {CollisionBoxArray} from '../data/array_types.js';
import type DEMData from '../data/dem_data.js';
import type {StyleGlyph} from '../style/style_glyph.js';
import type {StyleImage} from '../style/style_image.js';
import type {PromoteIdSpecification} from '../style-spec/types.js';
import type {Projection} from '../geo/projection/index.js';
import window from '../util/window.js';
const {ImageBitmap} = window;

export type TileParameters = {
    source: string,
    uid: number,
};

export type RequestedTileParameters = TileParameters & {
    tileID: OverscaledTileID,
    tileZoom: number,
    request: RequestParameters,
    data?: mixed,
    isSymbolTile: ?boolean
};

export type WorkerTileParameters = RequestedTileParameters & {
    zoom: number,
    maxZoom: number,
    tileSize: number,
    promoteId: ?PromoteIdSpecification,
    pixelRatio: number,
    showCollisionBoxes: boolean,
    collectResourceTiming?: boolean,
    returnDependencies?: boolean,
    enableTerrain?: boolean,
    projection: Projection
};

export type WorkerDEMTileParameters = TileParameters & {
    coord: { z: number, x: number, y: number, w: number },
    rawImageData: RGBAImage | ImageBitmap,
    encoding: "mapbox" | "terrarium",
    padding: number,
    buildQuadTree?: boolean
};

export type WorkerTileResult = {
    buckets: Array<Bucket>,
    imageAtlas: ImageAtlas,
    glyphAtlasImage: AlphaImage,
    lineAtlas: LineAtlas,
    featureIndex: FeatureIndex,
    collisionBoxArray: CollisionBoxArray,
    rawTileData?: ArrayBuffer,
    resourceTiming?: Array<PerformanceResourceTiming>,
    // Only used for benchmarking:
    glyphMap?: {[_: string]: {glyphs: {[_: number]: ?StyleGlyph}, ascender?: number, descender?: number}} | null,
    iconMap?: {[_: string]: StyleImage} | null,
    glyphPositions?: GlyphPositions | null
};

export type WorkerTileCallback = (error: ?Error, result: ?WorkerTileResult) => void;
export type WorkerDEMTileCallback = (err: ?Error, result: ?DEMData) => void;

/**
 * May be implemented by custom source types to provide code that can be run on
 * the WebWorkers. In addition to providing a custom
 * {@link WorkerSource#loadTile}, any other methods attached to a `WorkerSource`
 * implementation may also be targeted by the {@link Source} via
 * `dispatcher.getActor().send('source-type.methodname', params, callback)`.
 *
 * @see {@link Map#addSourceType}
 * @private
 *
 * @class WorkerSource
 * @param actor
 * @param layerIndex
 */
export interface WorkerSource {
    availableImages: Array<string>,
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

    /**
     * Tells the WorkerSource to abort in-progress tasks and release resources.
     * The foreground Source is responsible for ensuring that 'removeSource' is
     * the last message sent to the WorkerSource.
     */
    removeSource?: (params: {source: string}, callback: WorkerTileCallback) => void;
}
