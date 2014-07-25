'use strict';

var glmatrix = require('../lib/glmatrix.js'),
    mat2 = glmatrix.mat2,
    mat4 = glmatrix.mat4,
    vec2 = glmatrix.vec2;

module.exports = Tile;

function Tile() {}

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
        // Use 64 bit floats to avoid precision issues.
        this.posMatrix = new Float64Array(16);
        mat4.identity(this.posMatrix);
        mat4.translate(this.posMatrix, this.posMatrix, [transform.centerPoint.x, transform.centerPoint.y, 0]);
        mat4.rotateZ(this.posMatrix, this.posMatrix, transform.angle);
        mat4.translate(this.posMatrix, this.posMatrix, [-transform.x, -transform.y, 0]);
        mat4.translate(this.posMatrix, this.posMatrix, [scale * x, scale * y, 1]);

        // Create inverted matrix for interaction
        this.invPosMatrix = new Float64Array(16);
        mat4.invert(this.invPosMatrix, this.posMatrix);

        mat4.scale(this.posMatrix, this.posMatrix, [ scale / this.tileExtent, scale / this.tileExtent, 1 ]);
        mat4.multiply(this.posMatrix, painter.projectionMatrix, this.posMatrix);

        // The extrusion matrix.
        this.exMatrix = mat4.clone(painter.projectionMatrix);
        mat4.rotateZ(this.exMatrix, this.exMatrix, transform.angle);

        // 2x2 matrix for rotating points
        this.rotationMatrix = mat2.create();
        mat2.rotate(this.rotationMatrix, this.rotationMatrix, transform.angle);

        // Convert to 32-bit floats after we're done with all the transformations.
        this.posMatrix = new Float32Array(this.posMatrix);
        this.exMatrix = new Float32Array(this.exMatrix);
    },

    positionAt: function(id, point) {
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

    featuresAt: function(pos, params, callback) {
        this.source.map.dispatcher.send('query features', {
            id: this.id,
            x: pos.x,
            y: pos.y,
            scale: pos.scale,
            source: this.source.id,
            params: params
        }, callback, this.workerID);
    }
};
