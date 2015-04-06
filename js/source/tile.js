'use strict';

var glmatrix = require('gl-matrix');
var mat2 = glmatrix.mat2;
var mat4 = glmatrix.mat4;
var TileCoord = require('./tile_coord');
var util = require('../util/util');
var BufferSet = require('../data/buffer/buffer_set');

module.exports = Tile;

function Tile(id, size) {
    this.id = id;
    this.uid = util.uniqueId();
    this.loaded = false;
    this.zoom = TileCoord.fromID(id).z;
    this.uses = 0;
    this.tileSize = size;
}

Tile.prototype = {
    // todo unhardcode
    tileExtent: 4096,

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

    positionAt: function(coord) {
        coord = coord.zoomTo(this.zoom);
        var pos = TileCoord.fromID(this.id);
        return {
            x: (coord.column - pos.x) * 4096,
            y: (coord.row - pos.y) * 4096,
            scale: this.scale
        };
    },

    loadVectorData: function(data) {
        this.loaded = true;

        // empty GeoJSON tile
        if (!data) return;

        this.buffers = new BufferSet(data.buffers);
        this.elementGroups = data.elementGroups;
    },

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

    unloadVectorData: function(painter) {
        for (var b in this.buffers) {
            this.buffers[b].destroy(painter.gl);
        }
        this.buffers = null;
    }
};
