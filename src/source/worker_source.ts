import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';
import type {RequestParameters, ResponseCallback} from '../util/ajax';
import type {AlphaImage} from '../util/image';
import type {GlyphPositions} from '../render/glyph_atlas';
import type ImageAtlas from '../render/image_atlas';
import type LineAtlas from '../render/line_atlas';
import type {OverscaledTileID} from './tile_id';
import type {Bucket} from '../data/bucket';
import type FeatureIndex from '../data/feature_index';
import type {CollisionBoxArray} from '../data/array_types';
import type DEMData from '../data/dem_data';
import type {DEMSourceEncoding} from '../data/dem_data';
import type {GlyphMap} from '../render/glyph_manager';
import type {StyleImageMap} from '../style/style_image';
import type {PromoteIdSpecification} from '../style-spec/types';
import type Projection from '../geo/projection/projection';
import type {LUT} from '../util/lut';
import type {Callback} from '../types/callback';
import type {TDecodingResult, TProcessingBatch} from '../data/mrt/types';
import type {MapboxRasterTile} from '../data/mrt/mrt.esm.js';
import type {RasterizedImageMap, ImageRasterizationWorkerTasks} from '../render/image_manager';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';

/**
 * The parameters passed to the {@link MapWorker#getWorkerSource}.
 */
export type WorkerSourceRequest = {
    type: string; // The source type must be a string, because we can register new source types dynamically.
    source: string;
    scope: string;
};

/**
 * The parameters passed to the {@link WorkerSource#loadTile},
 * {@link WorkerSource#reloadTile}, {@link WorkerSource#abortTile}, and
 * {@link WorkerSource#removeTile}.
 */
export type WorkerSourceTileRequest = WorkerSourceRequest & {
    uid: number;
    tileID: OverscaledTileID;
    request?: RequestParameters;
    projection?: Projection;
};

/**
 * The parameters passed to the {@link VectorTileWorkerSource#loadTile}
 * and {@link VectorTileWorkerSource#reloadTile}.
 *
 * This is a superset of the parameters passed to the {@link WorkerSource#loadTile}
 * and {@link WorkerSource#reloadTile} with additional parameters specific to the vector tile source.
 *
 * @private
 */
export type WorkerSourceVectorTileRequest = WorkerSourceTileRequest & {
    brightness: number;
    lut: LUT | null;
    maxZoom: number;
    pixelRatio: number;
    promoteId: PromoteIdSpecification | null | undefined;
    scaleFactor: number;
    showCollisionBoxes: boolean;
    tileSize: number;
    tileZoom: number;
    zoom: number;
    data?: unknown;
    extraShadowCaster?: boolean;
    isSymbolTile?: boolean | null;
    partial?: boolean;
    tessellationStep?: number // test purpose only;
    worldview?: string | null;
    localizableLayerIds?: Set<string>;
};

/**
 * The parameters passed to the {@link Worker3dModelTileSource#loadTile}
 * and {@link Worker3dModelTileSource#reloadTile}.
 *
 * This is a superset of the parameters passed to the {@link WorkerSource#loadTile}
 * and {@link WorkerSource#reloadTile} with additional parameters specific to the 3D model tile source.
 *
 * @private
 */
export type WorkerSourceTiled3dModelRequest = WorkerSourceTileRequest & {
    brightness: number;
    pixelRatio: number;
    promoteId: PromoteIdSpecification | null | undefined;
    showCollisionBoxes: boolean;
    tileID: OverscaledTileID;
    tileSize: number;
    tileZoom: number;
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

/**
 * The parameters passed to the {@link VectorTileWorkerSource#loadTile}
 * and {@link VectorTileWorkerSource#reloadTile} callback.
 */
export type WorkerSourceVectorTileResult = {
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
    glyphMap?: GlyphMap;
    iconMap?: StyleImageMap<StringifiedImageVariant>;
    glyphPositions?: GlyphPositions;
    cacheControl?: string;
    expires?: string;
};

export type WorkerSourceDEMTileRequest = WorkerSourceTileRequest & {
    type: 'raster-dem';
    rawImageData: ImageData | ImageBitmap;
    encoding: DEMSourceEncoding;
    padding: number;
};

export type WorkerSourceRasterArrayTileRequest = WorkerSourceTileRequest & {
    type: 'raster-array';
    partial?: boolean;
    fetchLength?: number;
    sourceLayer?: string;
    band?: string | number;
};

export type WorkerSourceRasterArrayDecodingParameters = WorkerSourceTileRequest & {
    buffer: ArrayBuffer;
    task: TProcessingBatch;
};

export type WorkerSourceImageRaserizeParameters = {
    scope: string;
    tasks: ImageRasterizationWorkerTasks;
};

export type WorkerSourceRemoveRasterizedImagesParameters = {
    scope: string;
    imageIds: ImageId[];
};

export type WorkerSourceVectorTileCallback = Callback<WorkerSourceVectorTileResult>;
export type WorkerSourceDEMTileCallback = Callback<DEMData>;
export type WorkerSourceRasterArrayTileCallback = ResponseCallback<MapboxRasterTile>;
export type WorkerSourceRasterArrayDecodingCallback = Callback<TDecodingResult[]>;
export type WorkerSourceImageRaserizeCallback = Callback<RasterizedImageMap>;

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
 * @param availableImages
 * @param isSpriteLoaded
 * @param loadData
 * @param brightness
 */
export interface WorkerSource {
    availableImages?: ImageId[];

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering. Should call the callback with:
     * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
     */
    loadTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    /**
     * Re-parses a tile that has already been loaded. Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    reloadTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    /**
     * Aborts loading a tile that is in progress.
     */
    abortTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    /**
     * Removes this tile from any local caches.
     */
    removeTile: (params: WorkerSourceTileRequest, callback: Callback<unknown>) => void;
    /**
     * Tells the WorkerSource to abort in-progress tasks and release resources.
     * The foreground Source is responsible for ensuring that 'removeSource' is
     * the last message sent to the WorkerSource.
     */
    removeSource?: (params: {source: string}, callback: Callback<void>) => void;
}

export interface WorkerSourceConstructor {
    new(
        actor?: Actor,
        layerIndex?: StyleLayerIndex,
        availableImages?: ImageId[],
        isSpriteLoaded?: boolean,
        loadData?: (params: {source: string; scope: string}, callback: Callback<unknown>) => () => void | undefined,
        brightness?: number
    ): WorkerSource;
}
