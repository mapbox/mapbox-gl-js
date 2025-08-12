import {uniqueId, parseCacheControl} from '../util/util';
import {deserialize as deserializeBucket} from '../data/bucket';
import Feature from '../util/vectortile_to_geojson';
import featureFilter from '../style-spec/feature_filter/index';
import SymbolBucket from '../data/bucket/symbol_bucket';
import FillBucket from '../data/bucket/fill_bucket';
import LineBucket from '../data/bucket/line_bucket';
import {CollisionBoxArray, TileBoundsArray, PosArray, TriangleIndexArray, LineStripIndexArray, PosGlobeExtArray} from '../data/array_types';
import Texture from '../render/texture';
import browser from '../util/browser';
import {Debug} from '../util/debug';
import toEvaluationFeature from '../data/evaluation_feature';
import EvaluationParameters from '../style/evaluation_parameters';
import {lazyLoadRTLTextPlugin} from './rtl_text_plugin';
import {TileSpaceDebugBuffer} from '../data/debug_viz';
import Color from '../style-spec/util/color';
import loadGeometry from '../data/load_geometry';
import earcut from 'earcut';
import getTileMesh from './tile_mesh';
import tileTransform from '../geo/projection/tile_transform';
import {mercatorXfromLng, mercatorYfromLat} from '../geo/mercator_coordinate';
import boundsAttributes from '../data/bounds_attributes';
import posAttributes, {posAttributesGlobeExt} from '../data/pos_attributes';
import EXTENT from '../style-spec/data/extent';
import Point from '@mapbox/point-geometry';
import SegmentVector from '../data/segment';
import {transitionTileAABBinECEF, globeNormalizeECEF, tileCoordToECEF, globeToMercatorTransition, interpolateVec3} from '../geo/projection/globe_util';
import {vec3, mat4} from 'gl-matrix';

import type RasterParticleState from '../render/raster_particle_state';
import type FeatureIndex from '../data/feature_index';
import type {Bucket} from '../data/bucket';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type {WorkerSourceVectorTileResult} from './worker_source';
import type Actor from '../util/actor';
import type DEMData from '../data/dem_data';
import type {AlphaImage, SpritePositions} from '../util/image';
import type ImageAtlas from '../render/image_atlas';
import type LineAtlas from '../render/line_atlas';
import type ImageManager from '../render/image_manager';
import type Context from '../gl/context';
import type {CanonicalTileID, OverscaledTileID} from './tile_id';
import type Framebuffer from '../gl/framebuffer';
import type Transform from '../geo/transform';
import type {FeatureStates} from './source_state';
import type {Cancelable} from '../types/cancelable';
import type {FilterSpecification} from '../style-spec/types';
import type {TilespaceQueryGeometry} from '../style/query_geometry';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Projection from '../geo/projection/projection';
import type {TileTransform} from '../geo/projection/tile_transform';
import type Painter from '../render/painter';
import type {QrfQuery, QueryResult} from '../source/query_features';
import type {UserManagedTexture, TextureImage} from '../render/texture';
import type {VectorTileLayer} from '@mapbox/vector-tile';
import type {ImageId, StringifiedImageId} from '../style-spec/expression/types/image_id';

const CLOCK_SKEW_RETRY_TIMEOUT = 30000;
export type TileState =
    | 'loading'   // Tile data is in the process of loading.
    | 'loaded'    // Tile data has been loaded. Tile can be rendered.
    | 'empty'     // Tile data has been loaded but has no content for rendering.
    | 'reloading' // Tile data has been loaded and is being updated. Tile can be rendered.
    | 'unloaded'  // Tile data has been deleted.
    | 'errored'   // Tile data was not loaded because of an error.
    | 'expired';  // Tile data was previously loaded, but has expired per its HTTP headers and is in the process of refreshing.

export type ExpiryData = {
    cacheControl?: string;
    expires?: string;
};

// a tile bounds outline used for getting reprojected tile geometry in non-mercator projections
const BOUNDS_FEATURE = (() => {
    return {
        type: 2,
        extent: EXTENT,
        loadGeometry() {
            return [[
                new Point(0, 0),
                new Point(EXTENT + 1, 0),
                new Point(EXTENT + 1, EXTENT + 1),
                new Point(0, EXTENT + 1),
                new Point(0, 0)
            ]];
        }
    };
})();

/*
 * Returns a matrix that can be used to convert from tile coordinates to viewport pixel coordinates.
 */
function getPixelPosMatrix(transform: Transform, tileID: OverscaledTileID) {
    const t = mat4.fromScaling([] as unknown as mat4, [transform.width * 0.5, -transform.height * 0.5, 1]);
    mat4.translate(t, t, [1, -1, 0]);
    mat4.multiply(t, t, transform.calculateProjMatrix(tileID.toUnwrapped()));
    return Float32Array.from(t);
}

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @private
 */
class Tile {
    tileID: OverscaledTileID;
    uid: number;
    uses: number;
    tileSize: number;
    tileZoom: number;
    buckets: {
        [_: string]: Bucket;
    };
    latestFeatureIndex: FeatureIndex | null | undefined;
    latestRawTileData: ArrayBuffer | null | undefined;
    imageAtlas: ImageAtlas | null | undefined;
    imageAtlasTexture: Texture | null | undefined;
    lineAtlas: LineAtlas | null | undefined;
    lineAtlasTexture: Texture | null | undefined;
    glyphAtlasImage: AlphaImage | null | undefined;
    glyphAtlasTexture: Texture | null | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expirationTime: any;
    expiredRequestCount: number;
    state: TileState;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    timeAdded: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fadeEndTime: any;
    collisionBoxArray: CollisionBoxArray | null | undefined;
    redoWhenDone: boolean;
    showCollisionBoxes: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    placementSource: any;
    actor: Actor | null | undefined;
    vtLayers: {
        [_: string]: VectorTileLayer;
    };
    isSymbolTile: boolean | null | undefined;
    isExtraShadowCaster: boolean | null | undefined;
    isRaster: boolean | null | undefined;
    _tileTransform: TileTransform;

    neighboringTiles?: {
        [key: number]: {backfilled: boolean}
    };
    dem: DEMData | null | undefined;
    aborted: boolean | null | undefined;
    needsHillshadePrepare: boolean | null | undefined;
    needsDEMTextureUpload: boolean | null | undefined;
    request: Cancelable | null | undefined;
    texture: Texture | null | undefined | UserManagedTexture;
    hillshadeFBO: Framebuffer | null | undefined;
    demTexture: Texture | null | undefined;
    refreshedUponExpiration: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reloadCallback: any;
    resourceTiming: Array<PerformanceResourceTiming> | null | undefined;
    queryPadding: number;
    rasterParticleState: RasterParticleState | null | undefined;

    symbolFadeHoldUntil: number | null | undefined;
    hasSymbolBuckets: boolean;
    hasRTLText: boolean;
    dependencies: Record<string, Record<StringifiedImageId, boolean>>;
    projection: Projection;

    queryGeometryDebugViz: TileSpaceDebugBuffer | null | undefined;
    queryBoundsDebugViz: TileSpaceDebugBuffer | null | undefined;

    _tileDebugBuffer: VertexBuffer | null | undefined;
    _tileBoundsBuffer: VertexBuffer | null | undefined;
    _tileDebugIndexBuffer: IndexBuffer | null | undefined;
    _tileBoundsIndexBuffer: IndexBuffer;
    _tileDebugSegments: SegmentVector;
    _tileBoundsSegments: SegmentVector;
    _globeTileDebugBorderBuffer: VertexBuffer | null | undefined;
    _tileDebugTextBuffer: VertexBuffer | null | undefined;
    _tileDebugTextSegments: SegmentVector;
    _tileDebugTextIndexBuffer: IndexBuffer;
    _globeTileDebugTextBuffer: VertexBuffer | null | undefined;
    _lastUpdatedBrightness: number | null | undefined;

    worldview: string | undefined;

    /**
     * @param {OverscaledTileID} tileID
     * @param size
     * @private
     */
    constructor(tileID: OverscaledTileID, size: number, tileZoom: number, painter?: Painter | null, isRaster?: boolean, worldview?: string) {
        this.tileID = tileID;
        this.uid = uniqueId();
        this.uses = 0;
        this.tileSize = size;
        this.tileZoom = tileZoom;
        this.buckets = {};
        this.expirationTime = null;
        this.queryPadding = 0;
        this.hasSymbolBuckets = false;
        this.hasRTLText = false;
        this.dependencies = {};
        this.isRaster = isRaster;
        if (painter && painter.style) {
            this._lastUpdatedBrightness = painter.style.getBrightness();
        }

        // Counts the number of times a response was already expired when
        // received. We're using this to add a delay when making a new request
        // so we don't have to keep retrying immediately in case of a server
        // serving expired tiles.
        this.expiredRequestCount = 0;

        this.state = 'loading';

        if (painter && painter.transform) {
            this.projection = painter.transform.projection;
        }

        this.worldview = worldview;
    }

    registerFadeDuration(duration: number) {
        const fadeEndTime = duration + this.timeAdded;
        if (fadeEndTime < browser.now()) return;
        if (this.fadeEndTime && fadeEndTime < this.fadeEndTime) return;

        this.fadeEndTime = fadeEndTime;
    }

    wasRequested(): boolean {
        return this.state === 'errored' || this.state === 'loaded' || this.state === 'reloading';
    }

    get tileTransform(): TileTransform {
        if (!this._tileTransform) {
            this._tileTransform = tileTransform(this.tileID.canonical, this.projection);
        }
        return this._tileTransform;
    }

    /**
     * Given a data object with a 'buffers' property, load it into
     * this tile's elementGroups and buffers properties and set loaded
     * to true. If the data is null, like in the case of an empty
     * GeoJSON tile, no-op but still set loaded to true.
     * @param {Object} data
     * @param painter
     * @returns {undefined}
     * @private
     */
    loadVectorData(data: WorkerSourceVectorTileResult | null | undefined, painter: Painter, justReloaded?: boolean | null) {
        this.unloadVectorData();

        this.state = 'loaded';

        // empty GeoJSON tile
        if (!data) {
            this.collisionBoxArray = new CollisionBoxArray();
            return;
        }

        if (data.featureIndex) {
            this.latestFeatureIndex = data.featureIndex;
            if (data.rawTileData) {
                // Only vector tiles have rawTileData, and they won't update it for
                // 'reloadTile'
                this.latestRawTileData = data.rawTileData;
                this.latestFeatureIndex.rawTileData = data.rawTileData;
            } else if (this.latestRawTileData) {
                // If rawTileData hasn't updated, hold onto a pointer to the last
                // one we received
                this.latestFeatureIndex.rawTileData = this.latestRawTileData;
            }
        }
        this.collisionBoxArray = data.collisionBoxArray;
        this.buckets = deserializeBucket(data.buckets, painter.style);

        this.hasSymbolBuckets = false;
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                this.hasSymbolBuckets = true;
                if (justReloaded) {
                    bucket.justReloaded = true;
                } else {
                    break;
                }
            }
        }

        this.hasRTLText = false;
        if (this.hasSymbolBuckets) {
            for (const id in this.buckets) {
                const bucket = this.buckets[id];
                if (bucket instanceof SymbolBucket) {
                    if (bucket.hasRTLText) {
                        this.hasRTLText = true;
                        lazyLoadRTLTextPlugin();
                        break;
                    }
                }
            }
        }

        this.queryPadding = 0;
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            const layer = painter.style.getOwnLayer(id);
            if (!layer) continue;
            const queryRadius = layer.queryRadius(bucket);
            this.queryPadding = Math.max(this.queryPadding, queryRadius);
        }

        if (data.imageAtlas) {
            this.imageAtlas = data.imageAtlas;
        }
        if (data.glyphAtlasImage) {
            this.glyphAtlasImage = data.glyphAtlasImage;
        }
        if (data.lineAtlas) {
            this.lineAtlas = data.lineAtlas;
        }
        this._lastUpdatedBrightness = data.brightness;
    }

    /**
     * Release any data or WebGL resources referenced by this tile.
     * @returns {undefined}
     * @private
     */
    unloadVectorData() {
        if (!this.hasData()) return;

        for (const id in this.buckets) {
            this.buckets[id].destroy();
        }
        this.buckets = {};

        if (this.imageAtlas) {
            this.imageAtlas = null;
        }

        if (this.lineAtlas) {
            this.lineAtlas = null;
        }

        if (this.imageAtlasTexture) {
            this.imageAtlasTexture.destroy();
        }

        if (this.glyphAtlasTexture) {
            this.glyphAtlasTexture.destroy();
        }

        if (this.lineAtlasTexture) {
            this.lineAtlasTexture.destroy();
        }

        if (this._tileBoundsBuffer) {
            this._tileBoundsBuffer.destroy();
            this._tileBoundsIndexBuffer.destroy();
            this._tileBoundsSegments.destroy();
            this._tileBoundsBuffer = null;
        }

        if (this._tileDebugBuffer) {
            this._tileDebugBuffer.destroy();
            this._tileDebugSegments.destroy();
            this._tileDebugBuffer = null;
        }

        if (this._tileDebugIndexBuffer) {
            this._tileDebugIndexBuffer.destroy();
            this._tileDebugIndexBuffer = null;
        }

        if (this._globeTileDebugBorderBuffer) {
            this._globeTileDebugBorderBuffer.destroy();
            this._globeTileDebugBorderBuffer = null;
        }

        if (this._tileDebugTextBuffer) {
            this._tileDebugTextBuffer.destroy();
            this._tileDebugTextSegments.destroy();
            this._tileDebugTextIndexBuffer.destroy();
            this._tileDebugTextBuffer = null;
        }

        if (this._globeTileDebugTextBuffer) {
            this._globeTileDebugTextBuffer.destroy();
            this._globeTileDebugTextBuffer = null;
        }

        Debug.run(() => {
            if (this.queryGeometryDebugViz) {
                this.queryGeometryDebugViz.unload();
                delete this.queryGeometryDebugViz;
            }
            if (this.queryBoundsDebugViz) {
                this.queryBoundsDebugViz.unload();
                delete this.queryBoundsDebugViz;
            }
        });
        this.latestFeatureIndex = null;
        this.state = 'unloaded';
    }

    loadModelData(data: WorkerSourceVectorTileResult | null | undefined, painter: Painter, justReloaded?: boolean | null) {
        if (!data) {
            return;
        }

        if (data.resourceTiming) this.resourceTiming = data.resourceTiming;

        this.buckets = Object.assign({}, this.buckets, deserializeBucket(data.buckets, painter.style));

        if (data.featureIndex) {
            this.latestFeatureIndex = data.featureIndex;
        }
    }

    getBucket(layer: TypedStyleLayer): Bucket {
        return this.buckets[layer.fqid];
    }

    upload(context: Context) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket.uploadPending()) {
                bucket.upload(context);
            }
        }

        const gl = context.gl;
        const atlas = this.imageAtlas;
        if (atlas && !atlas.uploaded) {
            const hasPattern = !!atlas.patternPositions.size;
            this.imageAtlasTexture = new Texture(context, atlas.image, gl.RGBA8, {useMipmap: hasPattern});
            (this.imageAtlas).uploaded = true;
        }

        if (this.glyphAtlasImage) {
            this.glyphAtlasTexture = new Texture(context, this.glyphAtlasImage, gl.R8);
            this.glyphAtlasImage = null;
        }

        if (this.lineAtlas && !this.lineAtlas.uploaded) {
            this.lineAtlasTexture = new Texture(context, this.lineAtlas.image, gl.R8);
            (this.lineAtlas).uploaded = true;
        }
    }

    prepare(imageManager: ImageManager, painter: Painter | null | undefined, scope: string) {
        if (this.imageAtlas && this.imageAtlasTexture) {
            this.imageAtlas.patchUpdatedImages(imageManager, this.imageAtlasTexture, scope);
        }

        if (!painter || !this.latestFeatureIndex || !this.latestFeatureIndex.rawTileData) {
            return;
        }
        const brightness = painter.style.getBrightness();
        if (!this._lastUpdatedBrightness && !brightness) {
            return;
        }
        if (this._lastUpdatedBrightness && brightness && Math.abs(this._lastUpdatedBrightness - brightness) < 0.001) {
            return;
        }
        this.updateBuckets(painter, this._lastUpdatedBrightness !== brightness);
        this._lastUpdatedBrightness = brightness;
    }

    // Queries non-symbol features rendered for this tile.
    // Symbol features are queried globally
    queryRenderedFeatures(
        query: QrfQuery,
        tilespaceGeometry: TilespaceQueryGeometry,
        availableImages: ImageId[],
        transform: Transform,
        sourceCacheTransform: Transform,
        visualizeQueryGeometry: boolean,
    ): QueryResult {
        Debug.run(() => {
            if (visualizeQueryGeometry) {
                let geometryViz = this.queryGeometryDebugViz;
                let boundsViz = this.queryBoundsDebugViz;
                if (!geometryViz) {
                    geometryViz = this.queryGeometryDebugViz = new TileSpaceDebugBuffer(this.tileSize);
                }
                if (!boundsViz) {
                    boundsViz = this.queryBoundsDebugViz = new TileSpaceDebugBuffer(this.tileSize, Color.blue);
                }

                geometryViz.addPoints(tilespaceGeometry.tilespaceGeometry);
                boundsViz.addPoints(tilespaceGeometry.bufferedTilespaceGeometry);
            }
        });

        if (!this.latestFeatureIndex || !(this.latestFeatureIndex.rawTileData || this.latestFeatureIndex.is3DTile)) {
            return {};
        }

        const pixelPosMatrix = getPixelPosMatrix(sourceCacheTransform, this.tileID);

        return this.latestFeatureIndex.query(
            query,
            {
                tilespaceGeometry,
                pixelPosMatrix,
                transform,
                availableImages,
                tileTransform: this.tileTransform,
                worldview: this.worldview
            }
        );
    }

    querySourceFeatures(result: Array<Feature>, params?: {
        sourceLayer?: string;
        filter?: FilterSpecification;
        validate?: boolean;
    }) {
        const featureIndex = this.latestFeatureIndex;
        if (!featureIndex || !featureIndex.rawTileData) return;

        const vtLayers = featureIndex.loadVTLayers();

        const sourceLayer = params ? params.sourceLayer : '';
        const layer = vtLayers._geojsonTileLayer || vtLayers[sourceLayer];

        if (!layer) return;

        const filter = featureFilter(params && params.filter);
        const {z, x, y} = this.tileID.canonical;
        const coord = {z, x, y};

        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            if (filter.needGeometry) {
                const evaluationFeature = toEvaluationFeature(feature, true);
                if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ, {worldview: this.worldview}), evaluationFeature, this.tileID.canonical))
                    continue;
            } else if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ, {worldview: this.worldview}), feature)) {
                continue;
            }
            const id = featureIndex.getId(feature, sourceLayer);
            const geojsonFeature = new Feature(feature, z, x, y, id);
            geojsonFeature.tile = coord;

            result.push(geojsonFeature);
        }
    }

    loaded(): boolean {
        return this.state === 'loaded' || this.state === 'errored';
    }

    hasData(): boolean {
        return this.state === 'loaded' || this.state === 'reloading' || this.state === 'expired';
    }

    patternsLoaded(): boolean {
        return !!this.imageAtlas && !!this.imageAtlas.patternPositions.size;
    }

    setExpiryData(data: ExpiryData) {
        const prior = this.expirationTime;

        if (data.cacheControl) {
            const parsedCC = parseCacheControl(data.cacheControl);
            if (parsedCC['max-age']) this.expirationTime = Date.now() + parsedCC['max-age'] * 1000;
        } else if (data.expires) {
            this.expirationTime = new Date(data.expires).getTime();
        }

        if (this.expirationTime) {
            const now = Date.now();
            let isExpired = false;

            if (this.expirationTime > now) {
                isExpired = false;
            } else if (!prior) {
                isExpired = true;
            } else if (this.expirationTime < prior) {
                // Expiring date is going backwards:
                // fall back to exponential backoff
                isExpired = true;

            } else {
                const delta = this.expirationTime - prior;

                if (!delta) {
                    // Server is serving the same expired resource over and over: fall
                    // back to exponential backoff.
                    isExpired = true;

                } else {
                    // Assume that either the client or the server clock is wrong and
                    // try to interpolate a valid expiration date (from the client POV)
                    // observing a minimum timeout.
                    this.expirationTime = now + Math.max(delta, CLOCK_SKEW_RETRY_TIMEOUT);

                }
            }

            if (isExpired) {
                this.expiredRequestCount++;
                this.state = 'expired';
            } else {
                this.expiredRequestCount = 0;
            }
        }
    }

    getExpiryTimeout(): void | number {
        if (this.expirationTime) {
            if (this.expiredRequestCount) {
                return 1000 * (1 << Math.min(this.expiredRequestCount - 1, 31));
            } else {
                // Max value for `setTimeout` implementations is a 32 bit integer; cap this accordingly
                return Math.min(this.expirationTime - new Date().getTime(), Math.pow(2, 31) - 1);
            }
        }
    }

    refreshFeatureState(painter?: Painter) {
        if (!this.latestFeatureIndex || !(this.latestFeatureIndex.rawTileData || this.latestFeatureIndex.is3DTile) || !painter) {
            return;
        }

        this.updateBuckets(painter);
    }

    updateBuckets(painter: Painter, isBrightnessChanged?: boolean) {
        if (!this.latestFeatureIndex) return;
        if (!painter.style) return;

        const vtLayers = this.latestFeatureIndex.loadVTLayers();
        const availableImages = painter.style.listImages();
        const brightness = painter.style.getBrightness();

        for (const id in this.buckets) {
            if (!painter.style.hasLayer(id)) continue;

            const bucket = this.buckets[id];
            const bucketLayer = bucket.layers[0];
            // Buckets are grouped by common source-layer
            const sourceLayerId = bucketLayer['sourceLayer'] || '_geojsonTileLayer';
            const sourceLayer = vtLayers[sourceLayerId];
            const sourceCache = painter.style.getLayerSourceCache(bucketLayer);

            let sourceLayerStates: FeatureStates = {};
            if (sourceCache) {
                sourceLayerStates = sourceCache._state.getState(sourceLayerId, undefined) as FeatureStates;
            }

            const imagePositions: SpritePositions = this.imageAtlas ? Object.fromEntries(this.imageAtlas.patternPositions) : {};
            const withStateUpdates = Object.keys(sourceLayerStates).length > 0 && !isBrightnessChanged;
            const layers = withStateUpdates ? bucket.stateDependentLayers : bucket.layers;
            const updatesWithoutStateDependentLayers = withStateUpdates && !bucket.stateDependentLayers.length;
            if (!updatesWithoutStateDependentLayers || isBrightnessChanged) {
                bucket.update(sourceLayerStates, sourceLayer, availableImages, imagePositions, layers, isBrightnessChanged, brightness);
            }
            if (bucket instanceof LineBucket || bucket instanceof FillBucket) {
                if (painter._terrain && painter._terrain.enabled && sourceCache && bucket.uploadPending()) {
                    painter._terrain._clearRenderCacheForTile(sourceCache.id, this.tileID);
                }
            }
            const layer = painter && painter.style && painter.style.getOwnLayer(id);
            if (layer) {
                this.queryPadding = Math.max(this.queryPadding, layer.queryRadius(bucket));
            }
        }
    }

    holdingForFade(): boolean {
        return this.symbolFadeHoldUntil !== undefined;
    }

    symbolFadeFinished(): boolean {
        return !this.symbolFadeHoldUntil || this.symbolFadeHoldUntil < browser.now();
    }

    clearFadeHold() {
        this.symbolFadeHoldUntil = undefined;
    }

    setHoldDuration(duration: number) {
        this.symbolFadeHoldUntil = browser.now() + duration;
    }

    setTexture(img: TextureImage, painter: Painter) {
        const context = painter.context;
        const gl = context.gl;
        this.texture = this.texture || painter.getTileTexture(img.width);
        if (this.texture && this.texture instanceof Texture) {
            this.texture.update(img);
        } else {
            this.texture = new Texture(context, img, gl.RGBA8, {useMipmap: true});
            this.texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        }
    }

    setDependencies(namespace: string, dependencies: StringifiedImageId[]) {
        const index: Record<string, boolean> = {};
        for (const dep of dependencies) {
            index[dep] = true;
        }
        this.dependencies[namespace] = index;
    }

    hasDependency(namespaces: Array<string>, keys: StringifiedImageId[]): boolean {
        for (const namespace of namespaces) {
            const dependencies = this.dependencies[namespace];
            if (dependencies) {
                for (const key of keys) {
                    if (dependencies[key]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    clearQueryDebugViz() {
        Debug.run(() => {
            if (this.queryGeometryDebugViz) {
                this.queryGeometryDebugViz.clearPoints();
            }
            if (this.queryBoundsDebugViz) {
                this.queryBoundsDebugViz.clearPoints();
            }
        });
    }

    _makeDebugTileBoundsBuffers(context: Context, projection: Projection) {
        if (!projection || projection.name === 'mercator' || this._tileDebugBuffer) return;

        // reproject tile outline with adaptive resampling
        // @ts-expect-error - TS2345 - Argument of type '{ type: number; extent: number; loadGeometry(): Point[][]; }' is not assignable to parameter of type 'FeatureWithGeometry'.
        const boundsLine = loadGeometry(BOUNDS_FEATURE, this.tileID.canonical, this.tileTransform)[0];

        // generate vertices for debugging tile boundaries
        const debugVertices = new PosArray();
        const debugIndices = new LineStripIndexArray();

        for (let i = 0; i < boundsLine.length; i++) {
            const {x, y} = boundsLine[i];
            debugVertices.emplaceBack(x, y);
            debugIndices.emplaceBack(i);
        }
        debugIndices.emplaceBack(0);

        this._tileDebugIndexBuffer = context.createIndexBuffer(debugIndices);
        this._tileDebugBuffer = context.createVertexBuffer(debugVertices, posAttributes.members);
        this._tileDebugSegments = SegmentVector.simpleSegment(0, 0, debugVertices.length, debugIndices.length);
    }

    _makeTileBoundsBuffers(context: Context, projection: Projection) {
        if (this._tileBoundsBuffer || !projection || projection.name === 'mercator') return;

        // reproject tile outline with adaptive resampling
        // @ts-expect-error - TS2345 - Argument of type '{ type: number; extent: number; loadGeometry(): Point[][]; }' is not assignable to parameter of type 'FeatureWithGeometry'.
        const boundsLine = loadGeometry(BOUNDS_FEATURE, this.tileID.canonical, this.tileTransform)[0];

        let boundsVertices, boundsIndices;
        if (this.isRaster) {
            // for raster tiles, generate an adaptive MARTINI mesh
            const mesh = getTileMesh(this.tileID.canonical, projection);
            boundsVertices = mesh.vertices;
            boundsIndices = mesh.indices;

        } else {
            // for vector tiles, generate an Earcut triangulation of the outline
            boundsVertices = new TileBoundsArray();
            boundsIndices = new TriangleIndexArray();

            for (const {x, y} of boundsLine) {
                boundsVertices.emplaceBack(x, y, 0, 0);
            }
            const indices = earcut(boundsVertices.int16.subarray(0, boundsVertices.length * 4), undefined, 4);

            for (let i = 0; i < indices.length; i += 3) {
                boundsIndices.emplaceBack(indices[i], indices[i + 1], indices[i + 2]);
            }
        }
        this._tileBoundsBuffer = context.createVertexBuffer(boundsVertices, boundsAttributes.members);
        this._tileBoundsIndexBuffer = context.createIndexBuffer(boundsIndices);
        this._tileBoundsSegments = SegmentVector.simpleSegment(0, 0, boundsVertices.length, boundsIndices.length);
    }

    _makeGlobeTileDebugBuffers(context: Context, transform: Transform) {
        const projection = transform.projection;
        if (!projection || projection.name !== 'globe' || transform.freezeTileCoverage) return;

        const id = this.tileID.canonical;
        const bounds = transitionTileAABBinECEF(id, transform);
        const normalizationMatrix = globeNormalizeECEF(bounds);

        const phase = globeToMercatorTransition(transform.zoom);
        let worldToECEFMatrix;
        if (phase > 0.0) {
            worldToECEFMatrix = mat4.invert(new Float64Array(16), transform.globeMatrix);
        }

        this._makeGlobeTileDebugBorderBuffer(context, id, transform, normalizationMatrix, worldToECEFMatrix, phase);
        this._makeGlobeTileDebugTextBuffer(context, id, transform, normalizationMatrix, worldToECEFMatrix, phase);
    }

    _globePoint(
        x: number,
        y: number,
        id: CanonicalTileID,
        tr: Transform,
        normalizationMatrix: mat4,
        worldToECEFMatrix: mat4 | null | undefined,
        phase: number,
    ): vec3 {
        // The following is equivalent to doing globe.projectTilePoint.
        // This way we don't recompute the normalization matrix everytime since it remains the same for all points.
        let ecef = tileCoordToECEF(x, y, id) as vec3;
        if (worldToECEFMatrix) {
            // When in globe-to-Mercator transition, interpolate between globe and Mercator positions in ECEF
            const tileCount = 1 << id.z;

            // Wrap tiles to ensure that that Mercator interpolation is in the right direction
            const camX = mercatorXfromLng(tr.center.lng);
            const camY = mercatorYfromLat(tr.center.lat);

            const tileCenterX = (id.x + .5) / tileCount;
            const dx = tileCenterX - camX;
            let wrap = 0;
            if (dx > .5) {
                wrap = -1;
            } else if (dx < -.5) {
                wrap = 1;
            }

            let mercatorX = (x / EXTENT + id.x) / tileCount + wrap;
            let mercatorY = (y / EXTENT + id.y) / tileCount;
            mercatorX = (mercatorX - camX) * tr._pixelsPerMercatorPixel + camX;
            mercatorY = (mercatorY - camY) * tr._pixelsPerMercatorPixel + camY;
            const mercatorPos: vec3 = [mercatorX * tr.worldSize, mercatorY * tr.worldSize, 0];
            vec3.transformMat4(mercatorPos, mercatorPos, worldToECEFMatrix as unknown as mat4);
            ecef = interpolateVec3(ecef, mercatorPos, phase);
        }
        const gp = vec3.transformMat4(ecef, ecef, normalizationMatrix as unknown as mat4);
        return gp;
    }

    _makeGlobeTileDebugBorderBuffer(context: Context, id: CanonicalTileID, tr: Transform, normalizationMatrix: mat4, worldToECEFMatrix: mat4 | null | undefined, phase: number) {
        const vertices = new PosArray();
        const indices = new LineStripIndexArray();
        const extraGlobe = new PosGlobeExtArray();

        const addLine = (sx: number, sy: number, ex: number, ey: number, pointCount: number) => {
            const stepX = (ex - sx) / (pointCount - 1);
            const stepY = (ey - sy) / (pointCount - 1);

            const vOffset = vertices.length;

            for (let i = 0; i < pointCount; i++) {
                const x = sx + i * stepX;
                const y = sy + i * stepY;
                vertices.emplaceBack(x, y);

                const gp = this._globePoint(x, y, id, tr, normalizationMatrix, worldToECEFMatrix, phase);

                extraGlobe.emplaceBack(gp[0], gp[1], gp[2]);
                indices.emplaceBack(vOffset + i);
            }
        };

        const e = EXTENT;
        addLine(0, 0, e, 0, 16);
        addLine(e, 0, e, e, 16);
        addLine(e, e, 0, e, 16);
        addLine(0, e, 0, 0, 16);

        this._tileDebugIndexBuffer = context.createIndexBuffer(indices);
        this._tileDebugBuffer = context.createVertexBuffer(vertices, posAttributes.members);
        this._globeTileDebugBorderBuffer = context.createVertexBuffer(extraGlobe, posAttributesGlobeExt.members);
        this._tileDebugSegments = SegmentVector.simpleSegment(0, 0, vertices.length, indices.length);
    }

    _makeGlobeTileDebugTextBuffer(context: Context, id: CanonicalTileID, tr: Transform, normalizationMatrix: mat4, worldToECEFMatrix: mat4 | null | undefined, phase: number) {
        const SEGMENTS = 4;
        const numVertices = SEGMENTS + 1;
        const step = EXTENT / SEGMENTS;

        const vertices = new PosArray();
        const indices = new TriangleIndexArray();
        const extraGlobe = new PosGlobeExtArray();

        const totalVertices = numVertices * numVertices;
        const totalTriangles = SEGMENTS * SEGMENTS * 2;
        indices.reserve(totalTriangles);
        vertices.reserve(totalVertices);
        extraGlobe.reserve(totalVertices);

        const toIndex = (j: number, i: number): number => {
            return totalVertices * j + i;
        };

        // add vertices.
        for (let j = 0; j < totalVertices; j++) {
            const y = j * step;
            for (let i = 0; i < totalVertices; i++) {
                const x = i * step;
                vertices.emplaceBack(x, y);

                const gp = this._globePoint(x, y, id, tr, normalizationMatrix, worldToECEFMatrix, phase);
                extraGlobe.emplaceBack(gp[0], gp[1], gp[2]);
            }
        }

        // add indices.
        for (let j = 0; j < SEGMENTS; j++) {
            for (let i = 0; i < SEGMENTS; i++) {
                const tl = toIndex(j, i);
                const tr = toIndex(j, i + 1);
                const bl = toIndex(j + 1, i);
                const br = toIndex(j + 1, i + 1);

                // first triangle of the sub-patch.
                indices.emplaceBack(tl, tr, bl);

                // second triangle of the sub-patch.
                indices.emplaceBack(bl, tr, br);
            }
        }

        this._tileDebugTextIndexBuffer = context.createIndexBuffer(indices);
        this._tileDebugTextBuffer = context.createVertexBuffer(vertices, posAttributes.members);
        this._globeTileDebugTextBuffer = context.createVertexBuffer(extraGlobe, posAttributesGlobeExt.members);
        this._tileDebugTextSegments = SegmentVector.simpleSegment(0, 0, totalVertices, totalTriangles);
    }

    /**
     * Release data and WebGL resources referenced by this tile.
     * @returns {undefined}
     * @private
     */
    destroy(preserveTexture: boolean = false) {
        for (const id in this.buckets) {
            this.buckets[id].destroy();
        }

        this.buckets = {};

        if (this.imageAtlas) {
            this.imageAtlas = null;
        }

        if (this.lineAtlas) {
            this.lineAtlas = null;
        }

        if (this.imageAtlasTexture) {
            this.imageAtlasTexture.destroy();
            delete this.imageAtlasTexture;
        }

        if (this.glyphAtlasTexture) {
            this.glyphAtlasTexture.destroy();
            delete this.glyphAtlasTexture;
        }

        if (this.lineAtlasTexture) {
            this.lineAtlasTexture.destroy();
            delete this.lineAtlasTexture;
        }

        if (this._tileBoundsBuffer) {
            this._tileBoundsBuffer.destroy();
            this._tileBoundsIndexBuffer.destroy();
            this._tileBoundsSegments.destroy();
            this._tileBoundsBuffer = null;
        }

        if (this._tileDebugBuffer) {
            this._tileDebugBuffer.destroy();
            this._tileDebugSegments.destroy();
            this._tileDebugBuffer = null;
        }

        if (this._tileDebugIndexBuffer) {
            this._tileDebugIndexBuffer.destroy();
            this._tileDebugIndexBuffer = null;
        }

        if (this._globeTileDebugBorderBuffer) {
            this._globeTileDebugBorderBuffer.destroy();
            this._globeTileDebugBorderBuffer = null;
        }

        if (this._tileDebugTextBuffer) {
            this._tileDebugTextBuffer.destroy();
            this._tileDebugTextSegments.destroy();
            this._tileDebugTextIndexBuffer.destroy();
            this._tileDebugTextBuffer = null;
        }

        if (this._globeTileDebugTextBuffer) {
            this._globeTileDebugTextBuffer.destroy();
            this._globeTileDebugTextBuffer = null;
        }

        if (!preserveTexture && this.texture && this.texture instanceof Texture) {
            this.texture.destroy();
            delete this.texture;
        }

        if (this.hillshadeFBO) {
            this.hillshadeFBO.destroy();
            delete this.hillshadeFBO;
        }

        if (this.dem) {
            delete this.dem;
        }

        if (this.neighboringTiles) {
            delete this.neighboringTiles;
        }

        if (this.demTexture) {
            this.demTexture.destroy();
            delete this.demTexture;
        }

        if (this.rasterParticleState) {
            this.rasterParticleState.destroy();
            delete this.rasterParticleState;
        }

        Debug.run(() => {
            if (this.queryGeometryDebugViz) {
                this.queryGeometryDebugViz.unload();
                delete this.queryGeometryDebugViz;
            }
            if (this.queryBoundsDebugViz) {
                this.queryBoundsDebugViz.unload();
                delete this.queryBoundsDebugViz;
            }
        });
        this.latestFeatureIndex = null;
        this.state = 'unloaded';
    }
}

export default Tile;
