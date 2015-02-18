'use strict';

var glmatrix = require('gl-matrix');
var mat2 = glmatrix.mat2;
var mat4 = glmatrix.mat4;
var vec2 = glmatrix.vec2;
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

    calculateMatrices: function(z, x, y, transform, painter) {

        // Initialize model-view matrix that converts from the tile coordinates
        // to screen coordinates.
        var tileScale = Math.pow(2, z);
        var scale = transform.worldSize / tileScale;

        // TODO: remove
        this.scale = scale;

        // The position matrix
        this.posMatrix = mat4.create();
        mat4.translate(this.posMatrix, this.posMatrix, [transform.centerPoint.x, transform.centerPoint.y, 0]);
        mat4.rotateZ(this.posMatrix, this.posMatrix, transform.angle);
        mat4.translate(this.posMatrix, this.posMatrix, [-transform.centerPoint.x, -transform.centerPoint.y, 0]);

        var pixelX = transform.width / 2 - transform.x,
            pixelY = transform.height / 2 - transform.y;

        mat4.translate(this.posMatrix, this.posMatrix, [pixelX + x * scale, pixelY + y * scale, 1]);

        // Create inverted matrix for interaction
        this.invPosMatrix = mat4.create();
        mat4.invert(this.invPosMatrix, this.posMatrix);

        mat4.scale(this.posMatrix, this.posMatrix, [ scale / this.tileExtent, scale / this.tileExtent, 1 ]);
        mat4.multiply(this.posMatrix, painter.projectionMatrix, this.posMatrix);

        // The extrusion matrix.
        this.exMatrix = mat4.clone(painter.projectionMatrix);
        mat4.rotateZ(this.exMatrix, this.exMatrix, transform.angle);

        // 2x2 matrix for rotating points
        this.rotationMatrix = mat2.create();
        mat2.rotate(this.rotationMatrix, this.rotationMatrix, transform.angle);
    },

    positionAt: function(point) {
        // tile hasn't finished loading
        if (!this.invPosMatrix) return null;

        var pos = vec2.transformMat4([], [point.x, point.y], this.invPosMatrix);
        vec2.scale(pos, pos, 4096 / this.scale);
        return {
            x: pos[0],
            y: pos[1],
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

    unloadVectorData: function(painter) {
        for (var b in this.buffers) {
            this.buffers[b].destroy(painter.gl);
        }
        this.buffers = null;
    }
};
