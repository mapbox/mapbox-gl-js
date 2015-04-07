'use strict';

var glmatrix = require('gl-matrix');
var mat2 = glmatrix.mat2;
var mat4 = glmatrix.mat4;
var util = require('../util/util');
var BufferSet = require('../data/buffer/buffer_set');

module.exports = Tile;

/**
 * A tile object is the combination of a Coordinate, which defines
 * its place, as well as a unique ID and data tracking for its content
 *
 * @param {Coordinate} coord
 * @param {number} size
 * @param {sourceMaxZoom} the tile's source's maximum zoom level
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
    // todo unhardcode
    tileExtent: 4096,

    /**
     * Calculate the internal posMatrix that this tile uses to display
     * itself in a map, given a coordinate as (z, x, y) and a transform
     * @param {number} z
     * @param {number} x
     * @param {number} y
     * @param {Object} transform
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
        mat4.multiply(this.posMatrix, transform.getProjMatrix(), this.posMatrix);

        // The extrusion matrix.
        this.exMatrix = mat4.create();
        mat4.ortho(this.exMatrix, 0, transform.width, transform.height, 0, 0, -1);
        //mat4.rotateZ(this.exMatrix, this.exMatrix, -transform.angle);

        // 2x2 matrix for rotating points
        this.rotationMatrix = mat2.create();
        mat2.rotate(this.rotationMatrix, this.rotationMatrix, transform.angle);

        this.posMatrix = new Float32Array(this.posMatrix);
    },

    /**
     * Given a coordinate position, zoom that coordinate to my zoom and
     * scale and return a position in x, y, scale
     * @param {Coordinate} coord
     * @returns {Object} position
     */
    positionAt: function(coord, sourceMaxZoom) {
        coord = coord.zoomTo(Math.min(this.coord.z, sourceMaxZoom));
        return {
            x: (coord.column - this.coord.x) * 4096,
            y: (coord.row - this.coord.y) * 4096,
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
     */
    loadVectorData: function(data) {
        this.loaded = true;

        // empty GeoJSON tile
        if (!data) return;

        this.buffers = new BufferSet(data.buffers);
        this.elementGroups = data.elementGroups;
    },

    /**
     * given a data object and a GL painter, destroy and re-create
     * all of its buffers.
     * @param {Object} data
     * @param {Object} painter
     * @returns {undefined}
     */
    reloadSymbolData: function(data, painter) {

        if (!this.buffers) {
            // the tile has been destroyed
            return;
        }

        this.buffers.glyphVertex.destroy(painter.gl);
        this.buffers.glyphElement.destroy(painter.gl);
        this.buffers.iconVertex.destroy(painter.gl);
        this.buffers.iconElement.destroy(painter.gl);
        this.buffers.collisionBoxVertex.destroy(painter.gl);

        var buffers = new BufferSet(data.buffers);
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
     */
    unloadVectorData: function(painter) {
        for (var b in this.buffers) {
            this.buffers[b].destroy(painter.gl);
        }
        this.buffers = null;
    }
};
