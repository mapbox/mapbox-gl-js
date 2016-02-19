'use strict';

var util = require('../util/util');
var Bucket = require('../data/bucket');

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
    this.loaded = false; // TODO rename loaded
    this.isUnloaded = false;
    this.uses = 0;
    this.tileSize = size;
    this.sourceMaxZoom = sourceMaxZoom;
    this.buckets = {};
}

Tile.prototype = {

    /**
     * Converts a pixel value at a the given zoom level to tile units.
     *
     * The shaders mostly calculate everything in tile units so style
     * properties need to be converted from pixels to tile units using this.
     *
     * For example, a translation by 30 pixels at zoom 6.5 will be a
     * translation by pixelsToTileUnits(30, 6.5) tile units.
     *
     * @param {number} pixelValue
     * @param {number} z
     * @returns {number} value in tile units
     * @private
     */
    pixelsToTileUnits: function(pixelValue, z) {
        return pixelValue * (Bucket.EXTENT / (this.tileSize * Math.pow(2, z - this.coord.z)));
    },

    /**
     * Given a coordinate position, zoom that coordinate to my zoom and
     * scale and return a position in x, y, scale
     * @param {Coordinate} coord
     * @returns {Object} position
     * @private
     */
    positionAt: function(coord) {
        var zoomedCoord = coord.zoomTo(Math.min(this.coord.z, this.sourceMaxZoom));
        return {
            x: (zoomedCoord.column - this.coord.x) * Bucket.EXTENT,
            y: (zoomedCoord.row - this.coord.y) * Bucket.EXTENT
        };
    },

    /**
     * Given a data object with a 'buffers' property, load it into
     * this tile's elementGroups and buffers properties and set loaded
     * to true. If the data is null, like in the case of an empty
     * GeoJSON tile, no-op but still set loaded to true.
     * @param {Object} data
     * @returns {undefined}
     * @private
     */
    loadVectorData: function(data) {
        this.loaded = true;

        // empty GeoJSON tile
        if (!data) return;

        this.buckets = unserializeBuckets(data.buckets);
    },

    /**
     * given a data object and a GL painter, destroy and re-create
     * all of its buffers.
     * @param {Object} data
     * @param {Object} painter
     * @returns {undefined}
     * @private
     */
    // TODO rewrite this
    reloadSymbolData: function(data, painter) {
        if (this.isUnloaded) return;

        var newBuckets = unserializeBuckets(data.buckets);
        for (var id in newBuckets) {
            var newBucket = newBuckets[id];
            var oldBucket = this.buckets[id];

            oldBucket.destroy(painter.gl);
            this.buckets[id] = newBucket;
        }
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

        this.buckets = null;
        this.loaded = false;
        this.isUnloaded = true;
    },

    redoPlacement: function(source) {
        if (!this.loaded || this.redoingPlacement) {
            this.redoWhenDone = true;
            return;
        }

        this.redoingPlacement = true;

        source.dispatcher.send('redo placement', {
            uid: this.uid,
            source: source.id,
            angle: source.map.transform.angle,
            pitch: source.map.transform.pitch,
            collisionDebug: source.map.collisionDebug
        }, done.bind(this), this.workerID);

        function done(_, data) {
            this.reloadSymbolData(data, source.map.painter);
            source.fire('tile.load', {tile: this});

            this.redoingPlacement = false;
            if (this.redoWhenDone) {
                this.redoPlacement(source);
                this.redoWhenDone = false;
            }
        }
    },

    getBucket: function(layer) {
        return this.buckets && this.buckets[layer.ref || layer.id];
    }
};

function unserializeBuckets(input) {
    var output = {};
    for (var i = 0; i < input.length; i++) {
        var bucket = Bucket.create(input[i]);
        output[bucket.id] = bucket;
    }
    return output;
}
