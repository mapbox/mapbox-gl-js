import type {RequestParameters} from '../util/ajax';
import type {AlphaImage} from '../util/image';
import type {GlyphPositions} from '../render/glyph_atlas';
import type ImageAtlas from '../render/image_atlas';
import type LineAtlas from '../render/line_atlas';
import type {OverscaledTileID} from './tile_id';
import type {Bucket} from '../data/bucket';
import type FeatureIndex from '../data/feature_index';
import type {CollisionBoxArray} from '../data/array_types';
import type DEMData from '../data/dem_data';
import type {StyleGlyph} from '../style/style_glyph';
import type {StyleImage} from '../style/style_image';
import type {PromoteIdSpecification} from '../style-spec/types';
import type Projection from '../geo/projection/projection';
import type {LUT} from "../util/lut";

export type TileParameters = {
    source: string;
    scope: string;
    uid: number;
};

export type RequestedTileParameters = TileParameters & {
    tileID: OverscaledTileID;
    tileZoom: number;
    request: RequestParameters;
    data?: unknown;
    isSymbolTile: boolean | null | undefined;
};

export type WorkerTileParameters = RequestedTileParameters & {
    zoom: number;
    lut: LUT | null;
    maxZoom: number;
    tileSize: number;
    promoteId: PromoteIdSpecification | null | undefined;
    pixelRatio: number;
    showCollisionBoxes: boolean;
    collectResourceTiming?: boolean;
    projection: Projection;
    brightness: number;
    extraShadowCaster?: boolean;
    tessellationStep?: number // test purpose only;
    partial?: boolean;
};

export type DEMSourceEncoding = 'mapbox' | 'terrarium';

export type WorkerDEMTileParameters = TileParameters & {
    coord: {
        z: number;
        x: number;
        y: number;
        w: number;
    };
    rawImageData: ImageData | ImageBitmap;
    encoding: DEMSourceEncoding;
    padding: number;
    convertToFloat: boolean;
};

export type WorkerRasterArrayTileParameters = {
    buffer: ArrayBuffer;
    task: any;
};

export type WorkerTileResult = {
    buckets: Array<Bucket>;
    imageAtlas: ImageAtlas;
    glyphAtlasImage: AlphaImage;
    lineAtlas: LineAtlas;
    featureIndex: FeatureIndex;
    collisionBoxArray: CollisionBoxArray;
    rawTileData?: ArrayBuffer;
    resourceTiming?: Array<PerformanceResourceTiming>;
    brightness: number;
    // Only used for benchmarking:
    glyphMap?: {
        [_: string]: {
            glyphs: {
                [_: number]: StyleGlyph | null | undefined;
            };
            ascender?: number;
            descender?: number;
        };
    } | null;
    iconMap?: {
        [_: string]: StyleImage;
    } | null;
    glyphPositions?: GlyphPositions | null;
};

export type WorkerTileCallback = (
    error?: Error | null | undefined,
    result?: WorkerTileResult | null | undefined,
) => void;
export type WorkerDEMTileCallback = (err?: Error | null | undefined, result?: DEMData | null | undefined) => void;
export type WorkerRasterArrayTileCallback = (err?: Error | null | undefined, result?: any | null | undefined) => void;

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
    availableImages: Array<string>;
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
    removeSource?: (
        params: {
            source: string;
        },
        callback: WorkerTileCallback,
    ) => void;
}
