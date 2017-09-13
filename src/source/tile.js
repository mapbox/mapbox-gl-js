// @flow

const util = require('../util/util');
const deserializeBucket = require('../data/bucket').deserialize;
const SymbolBucket = require('../data/bucket/symbol_bucket');
const FeatureIndex = require('../data/feature_index');
const vt = require('@mapbox/vector-tile');
const Protobuf = require('pbf');
const GeoJSONFeature = require('../util/vectortile_to_geojson');
const featureFilter = require('../style-spec/feature_filter');
const CollisionTile = require('../symbol/collision_tile');
const CollisionBoxArray = require('../symbol/collision_box');
const Throttler = require('../util/throttler');
const Texture = require('../render/texture');

const CLOCK_SKEW_RETRY_TIMEOUT = 30000;

import type {Bucket} from '../data/bucket';
import type StyleLayer from '../style/style_layer';
import type TileCoord from './tile_coord';
import type {WorkerTileResult} from './worker_source';
import type Point from '@mapbox/point-geometry';
import type {RGBAImage, AlphaImage} from '../util/image';

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
    collisionTile: ?CollisionTile;
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

    aborted: ?boolean;
    request: any;
    texture: any;
    refreshedUponExpiration: boolean;
    reloadCallback: any;

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

        this.placementThrottler = new Throttler(300, this._immediateRedoPlacement.bind(this));
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
        if (!data) return;

        // If we are redoing placement for the same tile, we will not recieve
        // a new "rawTileData" object. If we are loading a new tile, we will
        // recieve a new "rawTileData" object.
        if (data.rawTileData) {
            this.rawTileData = data.rawTileData;
        }

        this.collisionBoxArray = new CollisionBoxArray(data.collisionBoxArray);
        this.collisionTile = CollisionTile.deserialize(data.collisionTile, this.collisionBoxArray);
        this.featureIndex = FeatureIndex.deserialize(data.featureIndex, this.rawTileData, this.collisionTile);
        this.buckets = deserializeBucket(data.buckets, painter.style);

        if (data.iconAtlasImage) {
            this.iconAtlasImage = data.iconAtlasImage;
        }
        if (data.glyphAtlasImage) {
            this.glyphAtlasImage = data.glyphAtlasImage;
        }
    }

    /**
     * Replace this tile's symbol buckets with fresh data.
     * @param {Object} data
     * @param {Style} style
     * @returns {undefined}
     * @private
     */
    reloadSymbolData(data: WorkerTileResult, style: any) {
        if (this.state === 'unloaded') return;

        this.collisionTile = CollisionTile.deserialize(data.collisionTile, this.collisionBoxArray);

        if (this.featureIndex) {
            this.featureIndex.setCollisionTile(this.collisionTile);
        }

        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket instanceof SymbolBucket) {
                bucket.destroy();
                delete this.buckets[id];
            }
        }

        // Add new symbol buckets
        util.extend(this.buckets, deserializeBucket(data.buckets, style));

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
        this.collisionTile = null;
        this.featureIndex = null;
        this.state = 'unloaded';
    }

    redoPlacement(source: any) {
        if (source.type !== 'vector' && source.type !== 'geojson') {
            return;
        }
        if (this.state !== 'loaded') {
            this.redoWhenDone = true;
            return;
        }
        if (!this.collisionTile) { // empty tile
            return;
        }

        const cameraToTileDistance = source.map.transform.cameraToTileDistance(this);
        if (this.angle === source.map.transform.angle &&
            this.pitch === source.map.transform.pitch &&
            this.showCollisionBoxes === source.map.showCollisionBoxes) {
            if (this.cameraToTileDistance === cameraToTileDistance &&
                this.cameraToCenterDistance === source.map.transform.cameraToCenterDistance) {
                return;
            } else if (this.pitch < 25) {
                // At low pitch tile distance doesn't affect placement very
                // much, so we skip the cost of redoPlacement
                // However, we might as well store the latest value of
                // cameraToTileDistance and cameraToCenterDistance in case a redoPlacement request
                // is already queued.
                this.cameraToTileDistance = cameraToTileDistance;
                this.cameraToCenterDistance = source.map.transform.cameraToCenterDistance;
                return;
            }
        }

        this.angle = source.map.transform.angle;
        this.pitch = source.map.transform.pitch;
        this.cameraToCenterDistance = source.map.transform.cameraToCenterDistance;
        this.cameraToTileDistance = cameraToTileDistance;
        this.showCollisionBoxes = source.map.showCollisionBoxes;
        this.placementSource = source;

        this.state = 'reloading';
        this.placementThrottler.invoke();
    }

    _immediateRedoPlacement() {
        this.placementSource.dispatcher.send('redoPlacement', {
            type: this.placementSource.type,
            uid: this.uid,
            source: this.placementSource.id,
            angle: this.angle,
            pitch: this.pitch,
            cameraToCenterDistance: this.cameraToCenterDistance,
            cameraToTileDistance: this.cameraToTileDistance,
            showCollisionBoxes: this.showCollisionBoxes
        }, (_, data) => {
            if (this.state !== 'reloading') return;

            this.state = 'loaded';
            this.reloadSymbolData(data, this.placementSource.map.style);
            this.placementSource.fire('data', {tile: this, coord: this.coord, dataType: 'source'});
            // HACK this is nescessary to fix https://github.com/mapbox/mapbox-gl-js/issues/2986
            if (this.placementSource.map) this.placementSource.map.painter.tileExtentVAO.vao = null;

            if (this.redoWhenDone) {
                this.state = 'reloading';
                this.redoWhenDone = false;
                this._immediateRedoPlacement();
            }
        }, this.workerID);
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
            queryGeometry,
            bearing,
            params,
            scale,
            additionalRadius,
            tileSize: this.tileSize,
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

    stopPlacementThrottler() {
        this.placementThrottler.stop();
        if (this.state === 'reloading') {
            this.state = 'loaded';
        }
    }
}

module.exports = Tile;
