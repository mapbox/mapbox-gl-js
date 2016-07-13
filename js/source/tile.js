'use strict';

var util = require('../util/util');
var Bucket = require('../data/bucket');
var FeatureIndex = require('../data/feature_index');
var vt = require('vector-tile');
var Protobuf = require('pbf');
var GeoJSONFeature = require('../util/vectortile_to_geojson');
var featureFilter = require('feature-filter');
var CollisionTile = require('../symbol/collision_tile');
var CollisionBoxArray = require('../symbol/collision_box');
var SymbolInstancesArray = require('../symbol/symbol_instances');
var SymbolQuadsArray = require('../symbol/symbol_quads');

module.exports = Tile;

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @param {Coordinate} coord
 * @param {number} size
 * @private
 */
function Tile(coord, size, sourceMaxZoom) {
    this.coord = coord;
    this.uid = util.uniqueId();
    this.uses = 0;
    this.tileSize = size;
    this.sourceMaxZoom = sourceMaxZoom;
    this.buckets = {};

    // `this.state` must be one of
    //
    // - `loading`:   Tile data is in the process of loading.
    // - `loaded`:    Tile data has been loaded. Tile can be rendered.
    // - `reloading`: Tile data has been loaded and is being updated. Tile can be rendered.
    // - `unloaded`:  Tile data has been deleted.
    // - `errored`:   Tile data was not loaded because of an error.
    this.state = 'loading';
}

Tile.prototype = {

    /**
     * Given a data object with a 'buffers' property, load it into
     * this tile's elementGroups and buffers properties and set loaded
     * to true. If the data is null, like in the case of an empty
     * GeoJSON tile, no-op but still set loaded to true.
     * @param {Object} data
     * @returns {undefined}
     * @private
     */
    loadVectorData: function(data, style) {
        this.state = 'loaded';

        // empty GeoJSON tile
        if (!data) return;

        this.collisionBoxArray = new CollisionBoxArray(data.collisionBoxArray);
        this.collisionTile = new CollisionTile(data.collisionTile, this.collisionBoxArray);
        this.symbolInstancesArray = new SymbolInstancesArray(data.symbolInstancesArray);
        this.symbolQuadsArray = new SymbolQuadsArray(data.symbolQuadsArray);
        this.featureIndex = new FeatureIndex(data.featureIndex, data.rawTileData, this.collisionTile);
        this.rawTileData = data.rawTileData;
        this.buckets = unserializeBuckets(data.buckets, style);
    },

    /**
     * given a data object and a GL painter, destroy and re-create
     * all of its buffers.
     * @param {Object} data
     * @param {Object} painter
     * @returns {undefined}
     * @private
     */
    reloadSymbolData: function(data, painter, style) {
        if (this.state === 'unloaded') return;

        this.collisionTile = new CollisionTile(data.collisionTile, this.collisionBoxArray);
        this.featureIndex.setCollisionTile(this.collisionTile);

        // Destroy and delete existing symbol buckets
        for (var id in this.buckets) {
            var bucket = this.buckets[id];
            if (bucket.type === 'symbol') {
                bucket.destroy(painter.gl);
                delete this.buckets[id];
            }
        }

        // Add new symbol buckets
        util.extend(this.buckets, unserializeBuckets(data.buckets, style));
    },

    /**
     * Make sure that this tile doesn't own any data within a given
     * painter, so that it doesn't consume any memory or maintain
     * any references to the painter.
     * @param {Object} painter gl painter object
     * @returns {undefined}
     * @private
     */
    unloadVectorData: function(painter) {
        for (var id in this.buckets) {
            var bucket = this.buckets[id];
            bucket.destroy(painter.gl);
        }

        this.collisionBoxArray = null;
        this.symbolQuadsArray = null;
        this.symbolInstancesArray = null;
        this.collisionTile = null;
        this.featureIndex = null;
        this.rawTileData = null;
        this.buckets = null;
        this.state = 'unloaded';
    },

    redoPlacement: function(source) {
        if (this.state !== 'loaded' || this.state === 'reloading') {
            this.redoWhenDone = true;
            return;
        }

        this.state = 'reloading';

        source.dispatcher.send('redo placement', {
            uid: this.uid,
            source: source.id,
            angle: source.map.transform.angle,
            pitch: source.map.transform.pitch,
            showCollisionBoxes: source.map.showCollisionBoxes
        }, done.bind(this), this.workerID);

        function done(_, data) {
            this.reloadSymbolData(data, source.map.painter, source.map.style);
            source.fire('tile.load', {tile: this});

            this.state = 'loaded';
            if (this.redoWhenDone) {
                this.redoPlacement(source);
                this.redoWhenDone = false;
            }
        }
    },

    getBucket: function(layer) {
        return this.buckets && this.buckets[layer.ref || layer.id];
    },

    querySourceFeatures: function(result, params) {
        if (!this.rawTileData) return;

        if (!this.vtLayers) {
            this.vtLayers = new vt.VectorTile(new Protobuf(new Uint8Array(this.rawTileData))).layers;
        }

        var layer = this.vtLayers._geojsonTileLayer || this.vtLayers[params.sourceLayer];

        if (!layer) return;

        var filter = featureFilter(params.filter);
        var coord = { z: this.coord.z, x: this.coord.x, y: this.coord.y };

        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            if (filter(feature)) {
                var geojsonFeature = new GeoJSONFeature(feature, this.coord.z, this.coord.x, this.coord.y);
                geojsonFeature.tile = coord;
                result.push(geojsonFeature);
            }
        }
    },

    isRenderable: function() {
        return this.state === 'loaded' || this.state === 'reloading';
    }
};

function unserializeBuckets(input, style) {
    // Guard against the case where the map's style has been set to null while
    // this bucket has been parsing.
    if (!style) return;

    var output = {};
    for (var i = 0; i < input.length; i++) {
        var layer = style.getLayer(input[i].layerId);
        if (!layer) continue;

        var bucket = Bucket.create(util.extend({
            layer: layer,
            childLayers: input[i].childLayerIds
                .map(style.getLayer.bind(style))
                .filter(function(layer) { return layer; })
        }, input[i]));
        output[bucket.id] = bucket;
    }
    return output;
}
