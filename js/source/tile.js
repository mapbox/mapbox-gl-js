'use strict';

var util = require('../util/util');
var Buffer = require('../data/buffer');
var EXTENT = require('../data/buffer').EXTENT;

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
    this.loaded = false;
    this.uses = 0;
    this.tileSize = size;
    this.sourceMaxZoom = sourceMaxZoom;
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
        return pixelValue * (EXTENT / (this.tileSize * Math.pow(2, z - this.coord.z)));
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
            x: (zoomedCoord.column - this.coord.x) * EXTENT,
            y: (zoomedCoord.row - this.coord.y) * EXTENT
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

        this.buffers = unserializeBuffers(data.buffers);
        this.elementGroups = data.elementGroups;
    },

    /**
     * given a data object and a GL painter, destroy and re-create
     * all of its buffers.
     * @param {Object} data
     * @param {Object} painter
     * @returns {undefined}
     * @private
     */
    reloadSymbolData: function(data, painter) {

        if (!this.buffers) {
            // the tile has been destroyed
            return;
        }

        if (this.buffers.glyphVertex) this.buffers.glyphVertex.destroy(painter.gl);
        if (this.buffers.glyphElement) this.buffers.glyphElement.destroy(painter.gl);
        if (this.buffers.iconVertex) this.buffers.iconVertex.destroy(painter.gl);
        if (this.buffers.iconElement) this.buffers.iconElement.destroy(painter.gl);
        if (this.buffers.collisionBoxVertex) this.buffers.collisionBoxVertex.destroy(painter.gl);

        var buffers = unserializeBuffers(data.buffers);
        this.buffers.glyphVertex = buffers.glyphVertex;
        this.buffers.glyphElement = buffers.glyphElement;
        this.buffers.iconVertex = buffers.iconVertex;
        this.buffers.iconElement = buffers.iconElement;
        this.buffers.collisionBoxVertex = buffers.collisionBoxVertex;

        for (var id in data.elementGroups) {
            this.elementGroups[id] = data.elementGroups[id];
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
        this.loaded = false;

        for (var b in this.buffers) {
            if (this.buffers[b]) this.buffers[b].destroy(painter.gl);
        }

        this.elementGroups = null;
        this.buffers = null;
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

    getElementGroups: function(layer, shaderName) {
        return this.elementGroups && this.elementGroups[layer.ref || layer.id] && this.elementGroups[layer.ref || layer.id][shaderName];
    }
};

function unserializeBuffers(input) {
    var output = {};
    for (var k in input) {
        output[k] = new Buffer(input[k]);
    }
    return output;
}
