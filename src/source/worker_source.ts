import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';
import type {RequestParameters} from '../util/ajax';
import type {AlphaImage, RGBAImage} from '../util/image';
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
import type {LUT} from '../util/lut';
import type {Callback} from '../types/callback';
import type {SourceType} from './source';

type TDecodingResult = any;

export type TileParameters = {
    source: string;
    scope: string;
    uid: number;
};

export type RequestedTileParameters = TileParameters & {
    brightness: number;
    lut: LUT | null;
    maxZoom: number;
    pixelRatio: number;
    promoteId: PromoteIdSpecification | null | undefined;
    scaleFactor: number;
    showCollisionBoxes: boolean;
    tileID: OverscaledTileID;
    tileSize: number;
    tileZoom: number;
    type: SourceType;
    zoom: number;
    data?: unknown;
    extraShadowCaster?: boolean;
    isSymbolTile?: boolean | null;
    partial?: boolean;
    request?: RequestParameters;
    tessellationStep?: number // test purpose only;
    worldview?: string | null;
    localizableLayerIds?: Set<string>;
};

export type WorkerTileParameters = RequestedTileParameters & {
    projection: Projection;
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
                [_: number]: StyleGlyph | undefined;
            };
            ascender?: number;
            descender?: number;
        };
    };
    iconMap?: {
        [_: string]: StyleImage;
    };
    glyphPositions?: GlyphPositions;
};

export type WorkerTileCallback = (error?: Error, result?: WorkerTileResult) => void;
export type WorkerDEMTileCallback = (err?: Error, result?: DEMData) => void;
export type WorkerRasterArrayTileCallback = (err?: Error, result?: TDecodingResult) => void;
export type WorkerImageRaserizeCallback = (err?: Error, result?: {[_: string]: RGBAImage}) => void;

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

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering. Should call the callback with:
     * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
     */
    loadTile: (params: WorkerTileParameters, callback: WorkerTileCallback) => void;
    /**
     * Re-parses a tile that has already been loaded. Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    reloadTile: (params: WorkerTileParameters, callback: WorkerTileCallback) => void;
    /**
     * Aborts loading a tile that is in progress.
     */
    abortTile: (params: TileParameters, callback: WorkerTileCallback) => void;
    /**
     * Removes this tile from any local caches.
     */
    removeTile: (params: TileParameters, callback: WorkerTileCallback) => void;
    /**
     * Tells the WorkerSource to abort in-progress tasks and release resources.
     * The foreground Source is responsible for ensuring that 'removeSource' is
     * the last message sent to the WorkerSource.
     */
    removeSource?: (params: {source: string}, callback: WorkerTileCallback) => void;
}

export interface WorkerSourceConstructor {
    new(
        actor: Actor,
        layerIndex: StyleLayerIndex,
        availableImages: Array<string>,
        isSpriteLoaded: boolean,
        loadData?: (params: {source: string; scope: string}, callback: Callback<unknown>) => () => void | undefined,
        brightness?: number
    ): WorkerSource;
}
