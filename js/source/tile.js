'use strict';

var mat4 = require('gl-matrix').mat4;
var util = require('../util/util');
var Buffer = require('../data/buffer');

module.exports = Tile;

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @param {Coordinate} coord
 * @param {number} size
 * @private
 */
function Tile(coord, size) {
    this.coord = coord;
    this.uid = util.uniqueId();
    this.loaded = false;
    this.uses = 0;
    this.tileSize = size;
}

Tile.prototype = {
    // todo unhardcode
    tileExtent: 4096,

    /**
     * Calculate the internal posMatrix that this tile uses to display
     * itself in a map, given a coordinate as (z, x, y) and a transform
     * @param {number} z
     * @param {number} x
     * @param {number} y
     * @param {Object} transform
     * @private
     */
    calculateMatrices: function(z, x, y, transform) {

        // Initialize model-view matrix that converts from the tile coordinates
        // to screen coordinates.
        var tileScale = Math.pow(2, z);
        var scale = transform.worldSize / tileScale;

        // TODO: remove
        this.scale = scale;

        // The position matrix
        this.posMatrix = new Float64Array(16);

        mat4.identity(this.posMatrix);
        mat4.translate(this.posMatrix, this.posMatrix, [x * scale, y * scale, 0]);
        mat4.scale(this.posMatrix, this.posMatrix, [ scale / this.tileExtent, scale / this.tileExtent, 1 ]);
        mat4.multiply(this.posMatrix, transform.projMatrix, this.posMatrix);

        this.posMatrix = new Float32Array(this.posMatrix);

        this.exMatrix = transform.exMatrix;
        this.rotationMatrix = transform.rotationMatrix;
    },

    /**
     * Given a coordinate position, zoom that coordinate to my zoom and
     * scale and return a position in x, y, scale
     * @param {Coordinate} coord
     * @returns {Object} position
     * @private
     */
    positionAt: function(coord, sourceMaxZoom) {
        coord = coord.zoomTo(Math.min(this.coord.z, sourceMaxZoom));
        return {
            x: (coord.column - this.coord.x) * this.tileExtent,
            y: (coord.row - this.coord.y) * this.tileExtent,
            scale: this.scale
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
        this.tileExtent = data.extent;
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
        for (var b in this.buffers) {
            this.buffers[b].destroy(painter.gl);
        }
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

    }
};

function unserializeBuffers(input) {
    var output = {};
    for (var k in input) {
        output[k] = new Buffer(input[k]);
    }
    return output;
}
