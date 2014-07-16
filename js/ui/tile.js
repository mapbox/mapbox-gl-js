'use strict';

var glmatrix = require('../lib/glmatrix.js');
var mat2 = glmatrix.mat2;
var mat4 = glmatrix.mat4;
var vec2 = glmatrix.vec2;

/*
 * Tiles are generally represented as packed integer ids constructed by
 * `Tile.toID(x, y, z)`
 */

var Tile = module.exports = {};

// todo unhardcode
Tile.tileExtent = 4096;

Tile.calculateMatrices = function(z, x, y, transform, painter) {

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

};

Tile.positionAt = function(id, point) {
    // tile hasn't finished loading
    if (!this.invPosMatrix) return null;

    var pos = vec2.transformMat4([], [point.x, point.y], this.invPosMatrix);
    vec2.scale(pos, pos, 4096 / this.scale);
    return {
        x: pos[0],
        y: pos[1],
        scale: this.scale
    };
};

Tile.toID = function(z, x, y, w) {
    w = w || 0;
    w *= 2;
    if (w < 0) w = w * -1 -1;
    var dim = 1 << z;
    return ((dim * dim * w + dim * y + x) * 32) + z;
};

Tile.asString = function(id) {
    var pos = Tile.fromID(id);
    return pos.z + "/" + pos.x + "/" + pos.y;
};

/*
 * Parse a packed integer id into an object with x, y, and z properties
 */
Tile.fromID = function(id) {
    var z = id % 32, dim = 1 << z;
    var xy = ((id - z) / 32);
    var x = xy % dim, y = ((xy - x) / dim) % dim;
    var w = Math.floor(xy / (dim * dim));
    if (w % 2 !== 0) w = w * -1 -1;
    w /= 2;
    return { z: z, x: x, y: y, w: w };
};

/*
 * Given a packed integer id, return its zoom level
 */
Tile.zoom = function(id) {
    return id % 32;
};

// Given an id and a list of urls, choose a url template and return a tile URL
Tile.url = function(id, urls) {
    var pos = Tile.fromID(id);

    return urls[Math.floor((pos.x + pos.y) % urls.length)]
        .replace('{h}', (pos.x % 16).toString(16) + (pos.y % 16).toString(16))
        .replace('{z}', pos.z.toFixed(0))
        .replace('{x}', pos.x.toFixed(0))
        .replace('{y}', pos.y.toFixed(0));
};

/*
 * Given a packed integer id, return the id of its parent tile
 */
Tile.parent = function(id) {
    var pos = Tile.fromID(id);
    if (pos.z === 0) return id;
    else return Tile.toID(pos.z - 1, Math.floor(pos.x / 2), Math.floor(pos.y / 2));
};

Tile.parentWithZoom = function(id, zoom) {
    var pos = Tile.fromID(id);
    while (pos.z > zoom) {
        pos.z--;
        pos.x = Math.floor(pos.x / 2);
        pos.y = Math.floor(pos.y / 2);
    }
    return Tile.toID(pos.z, pos.x, pos.y);
};

/*
 * Given a packed integer id, return an array of integer ids representing
 * its four children.
 */
Tile.children = function(id) {
    var pos = Tile.fromID(id);
    pos.z += 1;
    pos.x *= 2;
    pos.y *= 2;
    return [
        Tile.toID(pos.z, pos.x, pos.y),
        Tile.toID(pos.z, pos.x + 1, pos.y),
        Tile.toID(pos.z, pos.x, pos.y + 1),
        Tile.toID(pos.z, pos.x + 1, pos.y + 1)
    ];
};
