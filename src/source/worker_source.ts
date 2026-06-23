import type Actor from '../util/actor';
import type {MainInbox} from '../util/actor_messages';
import type StyleLayerIndex from '../style/style_layer_index';
import type {RequestParameters} from '../util/ajax';
import type {AlphaImage} from '../util/image';
import type {GlyphPositions} from '../render/glyph_atlas';
import type ImageAtlas from '../render/image_atlas';
import type {ImageAtlasReference} from '../render/image_atlas';
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
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {RenderSourceType} from './render_source_type';
import type {FrcCoverageParams, FrcCoveragePolygons} from './frc_coverage_snapshot';
import type {ElevationFeature} from '../../3d-style/elevation/elevation_feature';
import type {ElevationParams} from './elevation_coverage_snapshot';
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {StyleModelMap} from '../style/style_mode';
import type {IndoorTileOptions} from '../style/indoor_data.js';
import type {TileProvider} from './tile_provider';

/**
 * Source types that can instantiate a {@link WorkerSource} in {@link MapWorker}.
 */
export type WorkerSourceType =
    | 'vector'
    | 'geojson'
    | 'raster-dem'
    | 'raster-array'
    | 'batched-model';

/**
 * The parameters passed to the {@link MapWorker#getWorkerSource}.
 */
export type WorkerSourceRequest = {
    type: string; // The source type must be a string, because we can register new source types dynamically.
    uid: number;
    source: string;
    scope: string;
};

/**
 * The parameters passed to the {@link WorkerSource#loadTile},
 * {@link WorkerSource#reloadTile}, {@link WorkerSource#abortTile}, and
 * {@link WorkerSource#removeTile}.
 */
export type WorkerSourceTileRequest = WorkerSourceRequest & {
    tileID?: OverscaledTileID;
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
    showElevationIdDebug: boolean;
    tileSize: number;
    tileZoom: number;
    zoom: number;
    data?: {
        rawData: ArrayBuffer;
        headers: Headers;
    };
    extraShadowCaster?: boolean;
    renderSourceType?: RenderSourceType | null;
    frcCoverage?: FrcCoverageParams | null;
    elevation?: ElevationParams | null;
    crossSourceElevationEnabled?: boolean;
    terrainEnabled?: boolean;
    partial?: boolean;
    tessellationStep?: number // test purpose only;
    worldview?: string | null;
    localizableLayerIds?: Set<string>;
    indoor?: IndoorTileOptions | null;
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
    renderSourceType?: RenderSourceType | null;
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
    imageAtlas: ImageAtlas | ImageAtlasReference;
    glyphAtlasImage: AlphaImage;
    lineAtlas: LineAtlas;
    featureIndex: FeatureIndex;
    collisionBoxArray: CollisionBoxArray;
    hasTunnelGeometry?: boolean;
    // True when any transferred bucket carries an HD extension (elevated roads, etc.).
    // Main uses this flag to know whether to await the HD module before deserializing
    // the payload — without it, unregistered extension classes would cause a crash.
    containsHdExt?: boolean;
    // True when any transferred bucket requires the Standard module on main before it
    // can be deserialized (e.g. ModelBucket, Tiled3dModelBucket).
    containsStandardExt?: boolean;
    rawTileData?: ArrayBuffer;
    resourceTiming?: Array<PerformanceResourceTiming>;
    brightness: number;
    headers?: Headers;
    // Only used for benchmarking:
    glyphMap?: GlyphMap;
    iconMap?: StyleImageMap<StringifiedImageVariant>;
    glyphPositions?: GlyphPositions;
    frcCoveragePolygons?: FrcCoveragePolygons;
    hasDeferredRoadStructure?: boolean;
    parsedElevationFeatures?: ElevationFeature[];
    hasDeferredElevationFeatures?: boolean;
};

export type WorkerSourceDEMTileRequest = WorkerSourceTileRequest & {
    type: 'raster-dem';
    encoding: DEMSourceEncoding;
    request: RequestParameters;
};

export type WorkerSourceDEMTileResult = {
    dem: DEMData;
    borderReady: boolean;
    headers: Headers;
};

export type WorkerSourceRasterArrayTileRequest = WorkerSourceTileRequest & {
    type: 'raster-array';
    partial?: boolean;
    fetchLength?: number;
    sourceLayer?: string;
    band?: string | number;
};

export type WorkerSourceVectorTileCallback = Callback<WorkerSourceVectorTileResult>;

/**
 * May be implemented by custom source types to provide code that can be run on
 * the WebWorkers. In addition to providing a custom
 * {@link WorkerSource#loadTile}, any other methods attached to a `WorkerSource`
 * implementation may also be targeted by the {@link Source} via
 * `dispatcher.getActor().send('source-type.methodname', params, {signal})`.
 *
 * @see {@link Map#addSourceType}
 * @private
 */
export interface WorkerSource {
    availableImages?: ImageId[];
    availableModels?: StyleModelMap;
    tileProvider?: TileProvider<ArrayBuffer | ImageBitmap>;

    /**
     * Loads a tile from the given params and parse it into buckets ready to send
     * back to the main thread for rendering. Resolves with:
     * `{ buckets, featureIndex, collisionIndex, rawTileData}`.
     */
    loadTile: (params: WorkerSourceTileRequest) => Promise<unknown>;
    /**
     * Re-parses a tile that has already been loaded. Yields the same data as
     * {@link WorkerSource#loadTile}.
     */
    reloadTile: (params: WorkerSourceTileRequest) => Promise<unknown>;
    /**
     * Aborts loading a tile that is in progress.
     */
    abortTile: (params: WorkerSourceTileRequest) => void | Promise<void>;
    /**
     * Removes this tile from any local caches.
     */
    removeTile: (params: WorkerSourceTileRequest) => void | Promise<void>;
    /**
     * Tells the WorkerSource to abort in-progress tasks and release resources.
     * The foreground Source is responsible for ensuring that 'removeSource' is
     * the last message sent to the WorkerSource.
     */
    removeSource?: (params: {source: string}) => Promise<void>;
}

/**
 * The subset of {@link Actor} that a {@link WorkerSource} is allowed to use.
 * WorkerSources run in a worker shared by many maps, so {@link MapWorker} hands
 * them a delegate that stamps `targetMapId` onto every message rather than the
 * raw `Actor` (see {@link MapWorker#getWorkerSource}). Sourced from `Actor` via
 * `Pick` so the signatures can't drift. Worker sources only send back to the
 * main thread, hence `Actor<MainInbox>`.
 */
export type WorkerSourceActor = Pick<Actor<MainInbox>, 'send' | 'notify' | 'sendCancelable' | 'scheduler'>;

export type WorkerSourceOptions = {
    actor: WorkerSourceActor;
    layerIndex: StyleLayerIndex;
    availableImages: ImageId[];
    availableModels: StyleModelMap;
    isSpriteLoaded: boolean;
    tileProvider?: TileProvider<ArrayBuffer | ImageBitmap>;
    brightness?: number;
    worldview?: string;
    maxUniformBufferBindings?: number;
    maxUniformBlockSizeDwords?: number;
};

export interface WorkerSourceConstructor {
    new(options: WorkerSourceOptions): WorkerSource;
}
