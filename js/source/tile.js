'use strict';

const util = require('../util/util');
const Bucket = require('../data/bucket');
const FeatureIndex = require('../data/feature_index');
const vt = require('vector-tile');
const Protobuf = require('pbf');
const GeoJSONFeature = require('../util/vectortile_to_geojson');
const featureFilter = require('feature-filter');
const CollisionTile = require('../symbol/collision_tile');
const CollisionBoxArray = require('../symbol/collision_box');
const SymbolInstancesArray = require('../symbol/symbol_instances');
const SymbolQuadsArray = require('../symbol/symbol_quads');

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @private
 */
class Tile {
    /**
     * @param {Coordinate} coord
     * @param {number} size
     */
    constructor(coord, size, sourceMaxZoom) {
        this.coord = coord;
        this.uid = util.uniqueId();
        this.uses = 0;
        this.tileSize = size;
        this.sourceMaxZoom = sourceMaxZoom;
        this.buckets = {};
        this.expires = null;
        this.cacheControl = null;

        // `this.state` must be one of
        //
        // - `loading`:   Tile data is in the process of loading.
        // - `loaded`:    Tile data has been loaded. Tile can be rendered.
        // - `reloading`: Tile data has been loaded and is being updated. Tile can be rendered.
        // - `unloaded`:  Tile data has been deleted.
        // - `errored`:   Tile data was not loaded because of an error.
        // - `expired`:   Tile data was previously loaded, but has expired per its HTTP headers and is in the process of refreshing.
        this.state = 'loading';
    }

    registerFadeDuration(animationLoop, duration) {
        const fadeEndTime = duration + this.timeAdded;
        if (fadeEndTime < Date.now()) return;
        if (this.fadeEndTime && fadeEndTime < this.fadeEndTime) return;

        this.fadeEndTime = fadeEndTime;
        animationLoop.set(this.fadeEndTime - Date.now());
    }

    /**
     * Given a data object with a 'buffers' property, load it into
     * this tile's elementGroups and buffers properties and set loaded
     * to true. If the data is null, like in the case of an empty
     * GeoJSON tile, no-op but still set loaded to true.
     * @param {Object} data
     * @returns {undefined}
     * @private
     */
    loadVectorData(data, painter) {
        if (this.hasData()) {
            this.unloadVectorData(painter);
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
        this.collisionTile = new CollisionTile(data.collisionTile, this.collisionBoxArray);
        this.symbolInstancesArray = new SymbolInstancesArray(data.symbolInstancesArray);
        this.symbolQuadsArray = new SymbolQuadsArray(data.symbolQuadsArray);
        this.featureIndex = new FeatureIndex(data.featureIndex, this.rawTileData, this.collisionTile);
        this.buckets = Bucket.deserialize(data.buckets, painter.style);
    }

    /**
     * Replace this tile's symbol buckets with fresh data.
     * @param {Object} data
     * @param {Style} style
     * @returns {undefined}
     * @private
     */
    reloadSymbolData(data, style) {
        if (this.state === 'unloaded') return;

        this.collisionTile = new CollisionTile(data.collisionTile, this.collisionBoxArray);
        this.featureIndex.setCollisionTile(this.collisionTile);

        for (const id in this.buckets) {
            const bucket = this.buckets[id];
            if (bucket.layers[0].type === 'symbol') {
                bucket.destroy();
                delete this.buckets[id];
            }
        }

        // Add new symbol buckets
        util.extend(this.buckets, Bucket.deserialize(data.buckets, style));
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

        this.collisionBoxArray = null;
        this.symbolQuadsArray = null;
        this.symbolInstancesArray = null;
        this.collisionTile = null;
        this.featureIndex = null;
        this.state = 'unloaded';
    }

    redoPlacement(source) {
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

        this.state = 'reloading';

        source.dispatcher.send('redoPlacement', {
            type: source.type,
            uid: this.uid,
            source: source.id,
            angle: source.map.transform.angle,
            pitch: source.map.transform.pitch,
            showCollisionBoxes: source.map.showCollisionBoxes
        }, (_, data) => {
            this.reloadSymbolData(data, source.map.style);
            source.fire('data', {tile: this, coord: this.coord, dataType: 'tile'});

            // HACK this is nescessary to fix https://github.com/mapbox/mapbox-gl-js/issues/2986
            if (source.map) source.map.painter.tileExtentVAO.vao = null;

            this.state = 'loaded';

            if (this.redoWhenDone) {
                this.redoWhenDone = false;
                this.redoPlacement(source);
            }
        }, this.workerID);
    }

    getBucket(layer) {
        return this.buckets[layer.id];
    }

    querySourceFeatures(result, params) {
        if (!this.rawTileData) return;

        if (!this.vtLayers) {
            this.vtLayers = new vt.VectorTile(new Protobuf(this.rawTileData)).layers;
        }

        const layer = this.vtLayers._geojsonTileLayer || this.vtLayers[params.sourceLayer];

        if (!layer) return;

        const filter = featureFilter(params && params.filter);
        const coord = { z: this.coord.z, x: this.coord.x, y: this.coord.y };

        for (let i = 0; i < layer.length; i++) {
            const feature = layer.feature(i);
            if (filter(feature)) {
                const geojsonFeature = new GeoJSONFeature(feature, this.coord.z, this.coord.x, this.coord.y);
                geojsonFeature.tile = coord;
                result.push(geojsonFeature);
            }
        }
    }

    hasData() {
        return this.state === 'loaded' || this.state === 'reloading' || this.state === 'expired';
    }

    setExpiryData(data) {
        if (data.cacheControl) this.cacheControl = data.cacheControl;
        if (data.expires) this.expires = data.expires;
    }

    getExpiry() {
        if (this.cacheControl) {
            // Cache-Control headers set max age (in seconds) from the time of request
            const parsedCC = util.parseCacheControl(this.cacheControl);
            if (parsedCC['max-age']) return this.timeAdded + parsedCC['max-age'] * 1000;
        } else if (this.expires) {
            // Expires headers set absolute expiration times
            return new Date(this.expires).getTime();
        }
    }
}

module.exports = Tile;
