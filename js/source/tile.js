'use strict';

var glmatrix = require('gl-matrix'),
    mat2 = glmatrix.mat2,
    mat4 = glmatrix.mat4,
    vec2 = glmatrix.vec2;

module.exports = Tile;

function Tile() {}

Tile.prototype = {
    // todo unhardcode
    tileExtent: 4096,

    calculateMatrices(z, x, y, transform, painter) {

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

    positionAt(id, point) {
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

    featuresAt(pos, params, callback) {
        this.source.dispatcher.send('query features', {
            id: this.id,
            x: pos.x,
            y: pos.y,
            scale: pos.scale,
            source: this.source.id,
            params: params
        }, callback, this.workerID);
    }
};

var tiles = {
    vector: require('./vector_tile'),
    raster: require('./raster_tile')
};

Tile.create = function(type, id, source, url, callback) {
    return new tiles[type](id, source, url, callback);
};
