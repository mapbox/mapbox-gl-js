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
const CollisionBoxArray = require('../symbol/collision_box');
const RasterBoundsArray = require('../data/raster_bounds_array');
const TileCoord = require('./tile_coord');
const EXTENT = require('../data/extent');
const Point = require('@mapbox/point-geometry');
const VertexBuffer = require('../gl/vertex_buffer');
const VertexArrayObject = require('../render/vertex_array_object');
const Texture = require('../render/texture');
const projection = require('../symbol/projection');
const PlaceSymbols = require('../symbol/place_symbols');

const pixelsToTileUnits = require('../source/pixels_to_tile_units');

const CLOCK_SKEW_RETRY_TIMEOUT = 30000;

import type {Bucket} from '../data/bucket';
import type StyleLayer from '../style/style_layer';
import type {WorkerTileResult} from './worker_source';
import type {RGBAImage, AlphaImage} from '../util/image';
import type Mask from '../render/tile_mask';
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
    coord: TileCoord;
    uid: number;
    uses: number;
    tileSize: number;
    sourceMaxZoom: number;
    buckets: {[string]: Bucket};
    iconAtlasImage: ?RGBAImage;
    iconAtlasTexture: Texture;
    glyphAtlasImage: ?AlphaImage;
    glyphAtlasTexture: Texture;
    expirationTime: any;
    expiredRequestCount: number;
    state: TileState;
    placementThrottler: any;
    timeAdded: any;
    fadeEndTime: any;
    rawTileData: ArrayBuffer;
    collisionBoxArray: ?CollisionBoxArray;
    collisionIndex: ?CollisionIndex;
    featureIndex: ?FeatureIndex;
    redoWhenDone: boolean;
    angle: number;
    pitch: number;
    cameraToCenterDistance: number;
    cameraToTileDistance: number;
    showCollisionBoxes: boolean;
    placementSource: any;
    workerID: number;
    vtLayers: {[string]: VectorTileLayer};
    mask: Mask;
    aborted: ?boolean;
    maskedBoundsBuffer: ?VertexBuffer;
    maskedBoundsVAO: ?VertexArrayObject;
    request: any;
    texture: any;
    refreshedUponExpiration: boolean;
    reloadCallback: any;
    crossTileSymbolIndex: any;

    /**
     * @param {TileCoord} coord
     * @param size
     * @param sourceMaxZoom
     */
    constructor(coord: TileCoord, size: number, sourceMaxZoom: number) {
        this.coord = coord;
        this.uid = util.uniqueId();
        this.uses = 0;
        this.tileSize = size;
        this.sourceMaxZoom = sourceMaxZoom;
        this.buckets = {};
        this.expirationTime = null;

        // Counts the number of times a response was already expired when
        // received. We're using this to add a delay when making a new request
        // so we don't have to keep retrying immediately in case of a server
        // serving expired tiles.
        this.expiredRequestCount = 0;

        this.state = 'loading';
    }

    registerFadeDuration(animationLoop: any, duration: number) {
        const fadeEndTime = duration + this.timeAdded;
        if (fadeEndTime < Date.now()) return;
        if (this.fadeEndTime && fadeEndTime < this.fadeEndTime) return;

        this.fadeEndTime = fadeEndTime;
        animationLoop.set(this.fadeEndTime - Date.now());
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
        this.collisionBoxArray = new CollisionBoxArray(data.collisionBoxArray);
        this.featureIndex = FeatureIndex.deserialize(data.featureIndex, this.rawTileData);
        this.buckets = deserializeBucket(data.buckets, painter.style);

        if (data.iconAtlasImage) {
            this.iconAtlasImage = data.iconAtlasImage;
        }
        if (data.glyphAtlasImage) {
            this.glyphAtlasImage = data.glyphAtlasImage;
        }

        this.crossTileSymbolIndex = painter.crossTileSymbolIndex;

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
        this.crossTileSymbolIndex = null;
    }

    added() {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                this.crossTileSymbolIndex.addTileLayer(id, this.coord, this.sourceMaxZoom, bucket.symbolInstances);
            }
        }
    }

    removed() {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                this.crossTileSymbolIndex.removeTileLayer(id, this.coord, this.sourceMaxZoom);
            }
        }
    }

    placeLayer(showCollisionBoxes: boolean, collisionIndex: CollisionIndex, layer: any, posMatrix: Float32Array, collisionFadeTimes: any) {
        const bucket = this.getBucket(layer);

        if (bucket && bucket instanceof SymbolBucket) {
            collisionIndex.setMatrix(posMatrix);

            const pitchWithMap = bucket.layers[0].layout['text-pitch-alignment'] === 'map';
            const pixelRatio = pixelsToTileUnits(this, 1, collisionIndex.transform.zoom);
            const labelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix, pitchWithMap, true, collisionIndex.transform, pixelRatio);
            PlaceSymbols.place(bucket, collisionIndex, showCollisionBoxes, collisionIndex.transform.zoom, pixelRatio, labelPlaneMatrix, this.coord.id, this.collisionBoxArray);
            PlaceSymbols.updateOpacities(bucket, collisionFadeTimes);
        }
    }

    commitPlacement(collisionIndex: CollisionIndex) {
        // Don't update the collision index used for queryRenderedFeatures
        // until all layers have been updated to the same state
        if (this.featureIndex) {
            this.featureIndex.setCollisionIndex(collisionIndex);
        }
    }

    getBucket(layer: StyleLayer) {
        return this.buckets[layer.id];
    }

    upload(gl: WebGLRenderingContext) {
        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (!bucket.uploaded) {
                bucket.upload(gl);
                bucket.uploaded = true;
            }
        }

        if (this.iconAtlasImage) {
            this.iconAtlasTexture = new Texture(gl, this.iconAtlasImage, gl.RGBA);
            this.iconAtlasImage = null;
        }

        if (this.glyphAtlasImage) {
            this.glyphAtlasTexture = new Texture(gl, this.glyphAtlasImage, gl.ALPHA);
            this.glyphAtlasImage = null;
        }
    }

    queryRenderedFeatures(layers: {[string]: StyleLayer},
                          queryGeometry: Array<Array<Point>>,
                          scale: number,
                          params: { filter: FilterSpecification, layers: Array<string> },
                          bearing: number): {[string]: Array<{ featureIndex: number, feature: GeoJSONFeature }>} {
        if (!this.featureIndex)
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
            tileSourceMaxZoom: this.sourceMaxZoom,
            collisionBoxArray: this.collisionBoxArray
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
        const coord = { z: this.coord.z, x: this.coord.x, y: this.coord.y };

        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            if (filter(feature)) {
                const geojsonFeature = new GeoJSONFeature(feature, this.coord.z, this.coord.x, this.coord.y);
                (geojsonFeature: any).tile = coord;
                result.push(geojsonFeature);
            }
        }
    }

    setMask(mask: Mask, gl: WebGLRenderingContext) {

        // don't redo buffer work if the mask is the same;
        if (util.deepEqual(this.mask, mask)) return;

        this.mask = mask;
        this.maskedBoundsBuffer = undefined;
        this.maskedBoundsVAO = undefined;

        // We want to render the full tile, and keeping the segments/vertices/indices empty means
        // using the global shared buffers for covering the entire tile.
        if (util.deepEqual(mask, {'0': true})) return;
        const maskArray = Object.keys(mask);
        // mask is empty because all four children are loaded
        if (maskArray.length === 0) return;


        const maskedBoundsArray = new RasterBoundsArray();

        for (let i = 0; i < maskArray.length; i++) {
            const maskCoord = TileCoord.fromID(+maskArray[i]);
            const vertexExtent = EXTENT >> maskCoord.z;
            const tlVertex = new Point(maskCoord.x * vertexExtent, maskCoord.y * vertexExtent);
            const brVertex = new Point(tlVertex.x + vertexExtent, tlVertex.y + vertexExtent);

            maskedBoundsArray.emplaceBack(tlVertex.x, tlVertex.y, tlVertex.x, tlVertex.y);
            maskedBoundsArray.emplaceBack(brVertex.x, tlVertex.y, brVertex.x, tlVertex.y);
            maskedBoundsArray.emplaceBack(tlVertex.x, brVertex.y, tlVertex.x, brVertex.y);
            maskedBoundsArray.emplaceBack(brVertex.x, brVertex.y, brVertex.x, brVertex.y);
        }

        this.maskedBoundsBuffer = new VertexBuffer(gl, maskedBoundsArray);
        this.maskedBoundsVAO = new VertexArrayObject();
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
