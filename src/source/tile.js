// @flow

import {uniqueId, parseCacheControl} from '../util/util.js';
import {deserialize as deserializeBucket} from '../data/bucket.js';
import FeatureIndex from '../data/feature_index.js';
import GeoJSONFeature from '../util/vectortile_to_geojson.js';
import featureFilter from '../style-spec/feature_filter/index.js';
import SymbolBucket from '../data/bucket/symbol_bucket.js';
import {CollisionBoxArray, TileBoundsArray, PosArray, TriangleIndexArray, LineStripIndexArray} from '../data/array_types.js';
import Texture from '../render/texture.js';
import browser from '../util/browser.js';
import {Debug} from '../util/debug.js';
import toEvaluationFeature from '../data/evaluation_feature.js';
import EvaluationParameters from '../style/evaluation_parameters.js';
import SourceFeatureState from '../source/source_state.js';
import {lazyLoadRTLTextPlugin} from './rtl_text_plugin.js';
import {TileSpaceDebugBuffer} from '../data/debug_viz.js';
import Color from '../style-spec/util/color.js';
import loadGeometry from '../data/load_geometry.js';
import earcut from 'earcut';
import getTileMesh from './tile_mesh.js';
import tileTransform from '../geo/projection/tile_transform.js';

import boundsAttributes from '../data/bounds_attributes.js';
import EXTENT from '../data/extent.js';
import Point from '@mapbox/point-geometry';
import SegmentVector from '../data/segment.js';

const CLOCK_SKEW_RETRY_TIMEOUT = 30000;

import type {Bucket} from '../data/bucket.js';
import FillBucket from '../data/bucket/fill_bucket.js';
import LineBucket from '../data/bucket/line_bucket.js';
import type StyleLayer from '../style/style_layer.js';
import type {WorkerTileResult} from './worker_source.js';
import type Actor from '../util/actor.js';
import type DEMData from '../data/dem_data.js';
import type {AlphaImage} from '../util/image.js';
import type ImageAtlas from '../render/image_atlas.js';
import type LineAtlas from '../render/line_atlas.js';
import type ImageManager from '../render/image_manager.js';
import type Context from '../gl/context.js';
import type {OverscaledTileID} from './tile_id.js';
import type Framebuffer from '../gl/framebuffer.js';
import type Transform from '../geo/transform.js';
import type {LayerFeatureStates} from './source_state.js';
import type {Cancelable} from '../types/cancelable.js';
import type {FilterSpecification} from '../style-spec/types.js';
import type {TilespaceQueryGeometry} from '../style/query_geometry.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type {Projection} from '../geo/projection/index.js';
import type {TileTransform} from '../geo/projection/tile_transform.js';
import type Painter from '../render/painter.js';

export type TileState =
    | 'loading'   // Tile data is in the process of loading.
    | 'loaded'    // Tile data has been loaded. Tile can be rendered.
    | 'reloading' // Tile data has been loaded and is being updated. Tile can be rendered.
    | 'unloaded'  // Tile data has been deleted.
    | 'errored'   // Tile data was not loaded because of an error.
    | 'expired';  /* Tile data was previously loaded, but has expired per its
                   * HTTP headers and is in the process of refreshing. */

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
    buckets: {[_: string]: Bucket};
    latestFeatureIndex: ?FeatureIndex;
    latestRawTileData: ?ArrayBuffer;
    imageAtlas: ?ImageAtlas;
    imageAtlasTexture: Texture;
    lineAtlas: ?LineAtlas;
    lineAtlasTexture: Texture;
    glyphAtlasImage: ?AlphaImage;
    glyphAtlasTexture: Texture;
    expirationTime: any;
    expiredRequestCount: number;
    state: TileState;
    timeAdded: any;
    fadeEndTime: any;
    collisionBoxArray: ?CollisionBoxArray;
    redoWhenDone: boolean;
    showCollisionBoxes: boolean;
    placementSource: any;
    actor: ?Actor;
    vtLayers: {[_: string]: VectorTileLayer};
    isSymbolTile: ?boolean;
    isRaster: ?boolean;
    _tileTransform: TileTransform;

    neighboringTiles: ?Object;
    dem: ?DEMData;
    aborted: ?boolean;
    needsHillshadePrepare: ?boolean;
    needsDEMTextureUpload: ?boolean;
    request: ?Cancelable;
    texture: any;
    fbo: ?Framebuffer;
    demTexture: ?Texture;
    globeGridBuffer: ?VertexBuffer;
    globePoleBuffer: ?VertexBuffer;
    refreshedUponExpiration: boolean;
    reloadCallback: any;
    resourceTiming: ?Array<PerformanceResourceTiming>;
    queryPadding: number;

    symbolFadeHoldUntil: ?number;
    hasSymbolBuckets: boolean;
    hasRTLText: boolean;
    dependencies: Object;
    projection: Projection;

    queryGeometryDebugViz: TileSpaceDebugBuffer;
    queryBoundsDebugViz: TileSpaceDebugBuffer;

    _tileDebugBuffer: ?VertexBuffer;
    _tileBoundsBuffer: ?VertexBuffer;
    _tileDebugIndexBuffer: IndexBuffer;
    _tileBoundsIndexBuffer: IndexBuffer;
    _tileDebugSegments: SegmentVector;
    _tileBoundsSegments: SegmentVector;

    /**
     * @param {OverscaledTileID} tileID
     * @param size
     * @private
     */
    constructor(tileID: OverscaledTileID, size: number, tileZoom: number, painter: any, isRaster?: boolean) {
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

        // Counts the number of times a response was already expired when
        // received. We're using this to add a delay when making a new request
        // so we don't have to keep retrying immediately in case of a server
        // serving expired tiles.
        this.expiredRequestCount = 0;

        this.state = 'loading';

        if (painter && painter.transform) {
            this.projection = painter.transform.projection;
        }
    }

    registerFadeDuration(duration: number) {
        const fadeEndTime = duration + this.timeAdded;
        if (fadeEndTime < browser.now()) return;
        if (this.fadeEndTime && fadeEndTime < this.fadeEndTime) return;

        this.fadeEndTime = fadeEndTime;
    }

    wasRequested() {
        return this.state === 'errored' || this.state === 'loaded' || this.state === 'reloading';
    }

    get tileTransform() {
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
    loadVectorData(data: ?WorkerTileResult, painter: any, justReloaded: ?boolean) {
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
            this.queryPadding = Math.max(this.queryPadding, painter.style.getLayer(id).queryRadius(bucket));
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
            this._tileDebugIndexBuffer.destroy();
            this._tileDebugSegments.destroy();
            this._tileDebugBuffer = null;
        }

        if (this.globeGridBuffer) {
            this.globeGridBuffer.destroy();
            this.globeGridBuffer = null;
        }

        if (this.globePoleBuffer) {
            this.globePoleBuffer.destroy();
            this.globePoleBuffer = null;
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

    getBucket(layer: StyleLayer) {
        return this.buckets[layer.id];
    }

    upload(context: Context) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket.uploadPending()) {
                bucket.upload(context);
            }
        }

        const gl = context.gl;
        if (this.imageAtlas && !this.imageAtlas.uploaded) {
            this.imageAtlasTexture = new Texture(context, this.imageAtlas.image, gl.RGBA);
            this.imageAtlas.uploaded = true;
        }

        if (this.glyphAtlasImage) {
            this.glyphAtlasTexture = new Texture(context, this.glyphAtlasImage, gl.ALPHA);
            this.glyphAtlasImage = null;
        }

        if (this.lineAtlas && !this.lineAtlas.uploaded) {
            this.lineAtlasTexture = new Texture(context, this.lineAtlas.image, gl.ALPHA);
            this.lineAtlas.uploaded = true;
        }
    }

    prepare(imageManager: ImageManager) {
        if (this.imageAtlas) {
            this.imageAtlas.patchUpdatedImages(imageManager, this.imageAtlasTexture);
        }
    }

    // Queries non-symbol features rendered for this tile.
    // Symbol features are queried globally
    queryRenderedFeatures(layers: {[_: string]: StyleLayer},
                          serializedLayers: {[string]: Object},
                          sourceFeatureState: SourceFeatureState,
                          tileResult: TilespaceQueryGeometry,
                          params: { filter: FilterSpecification, layers: Array<string>, availableImages: Array<string> },
                          transform: Transform,
                          pixelPosMatrix: Float32Array,
                          visualizeQueryGeometry: boolean): {[_: string]: Array<{ featureIndex: number, feature: GeoJSONFeature }>} {
        Debug.run(() => {
            if (visualizeQueryGeometry) {
                if (!this.queryGeometryDebugViz) {
                    this.queryGeometryDebugViz = new TileSpaceDebugBuffer(this.tileSize);
                }
                if (!this.queryBoundsDebugViz) {
                    this.queryBoundsDebugViz = new TileSpaceDebugBuffer(this.tileSize, Color.blue);
                }

                this.queryGeometryDebugViz.addPoints(tileResult.tilespaceGeometry);
                this.queryBoundsDebugViz.addPoints(tileResult.bufferedTilespaceGeometry);
            }
        });

        if (!this.latestFeatureIndex || !this.latestFeatureIndex.rawTileData)
            return {};

        return this.latestFeatureIndex.query({
            tileResult,
            pixelPosMatrix,
            transform,
            params,
            tileTransform: this.tileTransform
        }, layers, serializedLayers, sourceFeatureState);
    }

    querySourceFeatures(result: Array<GeoJSONFeature>, params: any) {
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
                if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ), evaluationFeature, this.tileID.canonical)) continue;
            } else if (!filter.filter(new EvaluationParameters(this.tileID.overscaledZ), feature)) {
                continue;
            }
            const id = featureIndex.getId(feature, sourceLayer);
            const geojsonFeature = new GeoJSONFeature(feature, z, x, y, id);
            (geojsonFeature: any).tile = coord;
            result.push(geojsonFeature);
        }
    }

    hasData() {
        return this.state === 'loaded' || this.state === 'reloading' || this.state === 'expired';
    }

    patternsLoaded() {
        return this.imageAtlas && !!Object.keys(this.imageAtlas.patternPositions).length;
    }

    setExpiryData(data: any) {
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

    getExpiryTimeout() {
        if (this.expirationTime) {
            if (this.expiredRequestCount) {
                return 1000 * (1 << Math.min(this.expiredRequestCount - 1, 31));
            } else {
                // Max value for `setTimeout` implementations is a 32 bit integer; cap this accordingly
                return Math.min(this.expirationTime - new Date().getTime(), Math.pow(2, 31) - 1);
            }
        }
    }

    setFeatureState(states: LayerFeatureStates, painter: ?Painter) {
        if (!this.latestFeatureIndex ||
            !this.latestFeatureIndex.rawTileData ||
            Object.keys(states).length === 0 ||
            !painter) {
            return;
        }

        const vtLayers = this.latestFeatureIndex.loadVTLayers();
        const availableImages = painter.style.listImages();

        for (const id in this.buckets) {
            if (!painter.style.hasLayer(id)) continue;

            const bucket = this.buckets[id];
            // Buckets are grouped by common source-layer
            const sourceLayerId = bucket.layers[0]['sourceLayer'] || '_geojsonTileLayer';
            const sourceLayer = vtLayers[sourceLayerId];
            const sourceLayerStates = states[sourceLayerId];
            if (!sourceLayer || !sourceLayerStates || Object.keys(sourceLayerStates).length === 0) continue;

            bucket.update(sourceLayerStates, sourceLayer, availableImages, this.imageAtlas && this.imageAtlas.patternPositions || {});
            if (bucket instanceof LineBucket || bucket instanceof FillBucket) {
                const sourceCache = painter.style._getSourceCache(bucket.layers[0].source);
                if (painter._terrain && painter._terrain.enabled && sourceCache && bucket.programConfigurations.needsUpload) {
                    painter._terrain._clearRenderCacheForTile(sourceCache.id, this.tileID);
                }
            }
            const layer = painter && painter.style && painter.style.getLayer(id);
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

    setDependencies(namespace: string, dependencies: Array<string>) {
        const index = {};
        for (const dep of dependencies) {
            index[dep] = true;
        }
        this.dependencies[namespace] = index;
    }

    hasDependency(namespaces: Array<string>, keys: Array<string>) {
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
        this._tileDebugBuffer = context.createVertexBuffer(debugVertices, boundsAttributes.members);
        this._tileDebugSegments = SegmentVector.simpleSegment(0, 0, debugVertices.length, debugIndices.length);
    }

    _makeTileBoundsBuffers(context: Context, projection: Projection) {
        if (this._tileBoundsBuffer || !projection || projection.name === 'mercator') return;

        // reproject tile outline with adaptive resampling
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
            const indices = earcut(boundsVertices.int16, undefined, 4);
            for (let i = 0; i < indices.length; i += 3) {
                boundsIndices.emplaceBack(indices[i], indices[i + 1], indices[i + 2]);
            }
        }

        this._tileBoundsBuffer = context.createVertexBuffer(boundsVertices, boundsAttributes.members);
        this._tileBoundsIndexBuffer = context.createIndexBuffer(boundsIndices);
        this._tileBoundsSegments = SegmentVector.simpleSegment(0, 0, boundsVertices.length, boundsIndices.length);
    }
}

export default Tile;
