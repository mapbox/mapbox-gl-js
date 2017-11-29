// @flow

const util = require('../util/util');
const deserializeBucket = require('../data/bucket').deserialize;
const SymbolBucket = require('../data/bucket/symbol_bucket');
const FeatureIndex = require('../data/feature_index');
const vt = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const GeoJSONFeature = require('../util/vectortile_to_geojson');
const featureFilter = require('../style-spec/feature_filter');
const CollisionIndex = require('../symbol/collision_index');
const {
    RasterBoundsArray,
    CollisionBoxArray
} = require('../data/array_types');
const rasterBoundsAttributes = require('../data/raster_bounds_attributes');
const EXTENT = require('../data/extent');
const Point = require('@mapbox/point-geometry');
const Texture = require('../render/texture');
const {SegmentVector} = require('../data/segment');
const {TriangleIndexArray} = require('../data/index_array_type');
const projection = require('../symbol/projection');
const {performSymbolPlacement, updateOpacities} = require('../symbol/symbol_placement');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const browser = require('../util/browser');

const CLOCK_SKEW_RETRY_TIMEOUT = 30000;

import type {Bucket} from '../data/bucket';
import type StyleLayer from '../style/style_layer';
import type {WorkerTileResult} from './worker_source';
import type {DEMData} from '../data/dem_data';
import type {RGBAImage, AlphaImage} from '../util/image';
import type Mask from '../render/tile_mask';
import type CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index';
import type Context from '../gl/context';
import type IndexBuffer from '../gl/index_buffer';
import type VertexBuffer from '../gl/vertex_buffer';
import type {OverscaledTileID} from './tile_id';
import type Framebuffer from '../gl/framebuffer';

export type TileState =
    | 'loading'   // Tile data is in the process of loading.
    | 'loaded'    // Tile data has been loaded. Tile can be rendered.
    | 'reloading' // Tile data has been loaded and is being updated. Tile can be rendered.
    | 'unloaded'  // Tile data has been deleted.
    | 'errored'   // Tile data was not loaded because of an error.
    | 'expired';  /* Tile data was previously loaded, but has expired per its
                   * HTTP headers and is in the process of refreshing. */

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
    buckets: {[string]: Bucket};
    iconAtlasImage: ?RGBAImage;
    iconAtlasTexture: Texture;
    glyphAtlasImage: ?AlphaImage;
    glyphAtlasTexture: Texture;
    expirationTime: any;
    expiredRequestCount: number;
    state: TileState;
    timeAdded: any;
    fadeEndTime: any;
    rawTileData: ArrayBuffer;
    collisionBoxArray: ?CollisionBoxArray;
    collisionIndex: ?CollisionIndex;
    featureIndex: ?FeatureIndex;
    redoWhenDone: boolean;
    showCollisionBoxes: boolean;
    placementSource: any;
    workerID: number | void;
    vtLayers: {[string]: VectorTileLayer};
    mask: Mask;

    neighboringTiles: ?Object;
    dem: ?DEMData;
    aborted: ?boolean;
    maskedBoundsBuffer: ?VertexBuffer;
    maskedIndexBuffer: ?IndexBuffer;
    segments: ?SegmentVector;
    needsHillshadePrepare: ?boolean
    request: any;
    texture: any;
    fbo: ?Framebuffer;
    demTexture: ?Texture;
    refreshedUponExpiration: boolean;
    reloadCallback: any;
    justReloaded: boolean;

    /**
     * @param {OverscaledTileID} tileID
     * @param size
     */
    constructor(tileID: OverscaledTileID, size: number) {
        this.tileID = tileID;
        this.uid = util.uniqueId();
        this.uses = 0;
        this.tileSize = size;
        this.buckets = {};
        this.expirationTime = null;

        // Counts the number of times a response was already expired when
        // received. We're using this to add a delay when making a new request
        // so we don't have to keep retrying immediately in case of a server
        // serving expired tiles.
        this.expiredRequestCount = 0;

        this.state = 'loading';
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
    loadVectorData(data: WorkerTileResult, painter: any) {
        if (this.hasData()) {
            this.unloadVectorData();
        }

        this.state = 'loaded';

        // empty GeoJSON tile
        if (!data) {
            this.collisionBoxArray = new CollisionBoxArray();
            return;
        }

        if (data.rawTileData) {
            // Only vector tiles have rawTileData
            this.rawTileData = data.rawTileData;
        }
        this.collisionBoxArray = data.collisionBoxArray;
        this.featureIndex = data.featureIndex;
        this.featureIndex.rawTileData = this.rawTileData;
        this.buckets = deserializeBucket(data.buckets, painter.style);

        if (data.iconAtlasImage) {
            this.iconAtlasImage = data.iconAtlasImage;
        }
        if (data.glyphAtlasImage) {
            this.glyphAtlasImage = data.glyphAtlasImage;
        }
    }

    /**
     * Release any data or WebGL resources referenced by this tile.
     * @returns {undefined}
     * @private
     */
    unloadVectorData() {
        if (this.state === 'reloading') {
            this.justReloaded = true;
        }

        for (const id in this.buckets) {
            this.buckets[id].destroy();
        }
        this.buckets = {};

        if (this.iconAtlasTexture) {
            this.iconAtlasTexture.destroy();
        }
        if (this.glyphAtlasTexture) {
            this.glyphAtlasTexture.destroy();
        }

        this.collisionBoxArray = null;
        this.featureIndex = null;
        this.state = 'unloaded';
    }

    unloadDEMData() {
        this.dem = null;
        this.neighboringTiles = null;
        this.state = 'unloaded';
    }

    added(crossTileSymbolIndex: CrossTileSymbolIndex) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                crossTileSymbolIndex.addTileLayer(id, this.tileID, bucket.symbolInstances);
            }
        }
    }

    removed(crossTileSymbolIndex: CrossTileSymbolIndex) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                crossTileSymbolIndex.removeTileLayer(id, this.tileID);
            }
        }
    }

    placeLayer(showCollisionBoxes: boolean, collisionIndex: CollisionIndex, layer: any, sourceID: string) {
        const bucket = this.getBucket(layer);
        const collisionBoxArray = this.collisionBoxArray;

        if (bucket && bucket instanceof SymbolBucket && collisionBoxArray) {
            const posMatrix = collisionIndex.transform.calculatePosMatrix(this.tileID.toUnwrapped());

            const pitchWithMap = bucket.layers[0].layout.get('text-pitch-alignment') === 'map';
            const textPixelRatio = EXTENT / this.tileSize; // text size is not meant to be affected by scale
            const pixelRatio = pixelsToTileUnits(this, 1, collisionIndex.transform.zoom);

            const labelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix, pitchWithMap, true, collisionIndex.transform, pixelRatio);
            performSymbolPlacement(bucket, collisionIndex, showCollisionBoxes, collisionIndex.transform.zoom, textPixelRatio, posMatrix, labelPlaneMatrix, this.tileID.key, sourceID, collisionBoxArray);
        }
    }

    commitPlacement(collisionIndex: CollisionIndex, collisionFadeTimes: any, angle: number) {
        // Start all collision animations at the same time
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                updateOpacities(bucket, collisionFadeTimes, this.justReloaded);
                bucket.sortFeatures(angle);
            }
        }

        // Don't update the collision index used for queryRenderedFeatures
        // until all layers have been updated to the same state
        if (this.featureIndex) {
            this.featureIndex.setCollisionIndex(collisionIndex);
        }

        this.justReloaded = false;
    }

    getBucket(layer: StyleLayer) {
        return this.buckets[layer.id];
    }

    upload(context: Context) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (!bucket.uploaded) {
                bucket.upload(context);
                bucket.uploaded = true;
            }
        }

        const gl = context.gl;

        if (this.iconAtlasImage) {
            this.iconAtlasTexture = new Texture(context, this.iconAtlasImage, gl.RGBA);
            this.iconAtlasImage = null;
        }

        if (this.glyphAtlasImage) {
            this.glyphAtlasTexture = new Texture(context, this.glyphAtlasImage, gl.ALPHA);
            this.glyphAtlasImage = null;
        }
    }

    queryRenderedFeatures(layers: {[string]: StyleLayer},
                          queryGeometry: Array<Array<Point>>,
                          scale: number,
                          params: { filter: FilterSpecification, layers: Array<string> },
                          bearing: number,
                          sourceID: string): {[string]: Array<{ featureIndex: number, feature: GeoJSONFeature }>} {
        if (!this.featureIndex || !this.collisionBoxArray)
            return {};

        // Determine the additional radius needed factoring in property functions
        let additionalRadius = 0;
        for (const id in layers) {
            const bucket = this.getBucket(layers[id]);
            if (bucket) {
                additionalRadius = Math.max(additionalRadius, layers[id].queryRadius(bucket));
            }
        }

        return this.featureIndex.query({
            queryGeometry: queryGeometry,
            scale: scale,
            tileSize: this.tileSize,
            bearing: bearing,
            params: params,
            additionalRadius: additionalRadius,
            collisionBoxArray: this.collisionBoxArray,
            sourceID: sourceID
        }, layers);
    }

    querySourceFeatures(result: Array<GeoJSONFeature>, params: any) {
        if (!this.rawTileData) return;

        if (!this.vtLayers) {
            this.vtLayers = new vt.VectorTile(new Protobuf(this.rawTileData)).layers;
        }

        const sourceLayer = params ? params.sourceLayer : '';
        const layer = this.vtLayers._geojsonTileLayer || this.vtLayers[sourceLayer];

        if (!layer) return;

        const filter = featureFilter(params && params.filter);
        const coord = { z: this.tileID.overscaledZ, x: this.tileID.canonical.x, y: this.tileID.canonical.y };

        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            if (filter({zoom: this.tileID.overscaledZ}, feature)) {
                const geojsonFeature = new GeoJSONFeature(feature, coord.z, coord.x, coord.y);
                (geojsonFeature: any).tile = coord;
                result.push(geojsonFeature);
            }
        }
    }

    clearMask() {
        if (this.segments) {
            this.segments.destroy();
            delete this.segments;
        }
        if (this.maskedBoundsBuffer) {
            this.maskedBoundsBuffer.destroy();
            delete this.maskedBoundsBuffer;
        }
        if (this.maskedIndexBuffer) {
            this.maskedIndexBuffer.destroy();
            delete this.maskedIndexBuffer;
        }
    }

    setMask(mask: Mask, context: Context) {

        // don't redo buffer work if the mask is the same;
        if (util.deepEqual(this.mask, mask)) return;

        this.mask = mask;
        this.clearMask();

        // We want to render the full tile, and keeping the segments/vertices/indices empty means
        // using the global shared buffers for covering the entire tile.
        if (util.deepEqual(mask, {'0': true})) return;

        const maskedBoundsArray = new RasterBoundsArray();
        const indexArray = new TriangleIndexArray();

        this.segments = new SegmentVector();
        // Create a new segment so that we will upload (empty) buffers even when there is nothing to
        // draw for this tile.
        this.segments.prepareSegment(0, maskedBoundsArray, indexArray);

        const maskArray = Object.keys(mask);
        for (let i = 0; i < maskArray.length; i++) {
            const maskCoord = mask[maskArray[i]];
            const vertexExtent = EXTENT >> maskCoord.z;
            const tlVertex = new Point(maskCoord.x * vertexExtent, maskCoord.y * vertexExtent);
            const brVertex = new Point(tlVertex.x + vertexExtent, tlVertex.y + vertexExtent);

            // not sure why flow is complaining here because it doesn't complain at L401
            const segment = (this.segments: any).prepareSegment(4, maskedBoundsArray, indexArray);

            maskedBoundsArray.emplaceBack(tlVertex.x, tlVertex.y, tlVertex.x, tlVertex.y);
            maskedBoundsArray.emplaceBack(brVertex.x, tlVertex.y, brVertex.x, tlVertex.y);
            maskedBoundsArray.emplaceBack(tlVertex.x, brVertex.y, tlVertex.x, brVertex.y);
            maskedBoundsArray.emplaceBack(brVertex.x, brVertex.y, brVertex.x, brVertex.y);

            const offset = segment.vertexLength;
            // 0, 1, 2
            // 1, 2, 3
            indexArray.emplaceBack(offset, offset + 1, offset + 2);
            indexArray.emplaceBack(offset + 1, offset + 2, offset + 3);

            segment.vertexLength += 4;
            segment.primitiveLength += 2;
        }

        this.maskedBoundsBuffer = context.createVertexBuffer(maskedBoundsArray, rasterBoundsAttributes.members);
        this.maskedIndexBuffer = context.createIndexBuffer(indexArray);
    }

    hasData() {
        return this.state === 'loaded' || this.state === 'reloading' || this.state === 'expired';
    }

    setExpiryData(data: any) {
        const prior = this.expirationTime;

        if (data.cacheControl) {
            const parsedCC = util.parseCacheControl(data.cacheControl);
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
}

module.exports = Tile;
