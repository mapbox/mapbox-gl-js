'use strict';

var assert = require('assert');
var Coordinate = require('../geo/coordinate');

module.exports = TileCoord;

function TileCoord(z, x, y, w, sourceMaxZoom) {
    assert(!isNaN(z) && z >= 0 && z % 1 === 0);
    assert(!isNaN(x) && x >= 0 && x % 1 === 0);
    assert(!isNaN(y) && y >= 0 && y % 1 === 0);
    assert(!isNaN(w));
    assert(!isNaN(sourceMaxZoom) && sourceMaxZoom >= 0);

    // the zoom level used for styling
    this.z = +z;
    this.x = +x;
    this.y = +y;
    this.w = +w;
    // the maximum zoom level of the source used to load data
    this.sourceMaxZoom = sourceMaxZoom;
    // the zoom level used for loading data
    this.dataZ = Math.min(sourceMaxZoom, z);

    // calculate id
    w *= 2;
    if (w < 0) w = w * -1 - 1;
    var dim = 1 << this.z;
    this.id = ((dim * dim * w + dim * this.y + this.x) * 32) + this.z;
}

TileCoord.prototype.toString = function() {
    return this.z + "/" + this.x + "/" + this.y;
};

TileCoord.prototype.toCoordinate = function() {
    var zoom = this.dataZ;
    var tileScale = Math.pow(2, zoom);
    var row = this.y;
    var column = this.x + tileScale * this.w;
    return new Coordinate(column, row, zoom);
};

// Parse a packed integer id into a TileCoord object
TileCoord.fromID = function(id, sourceMaxZoom) {
    var z = id % 32, dim = 1 << z;
    var xy = ((id - z) / 32);
    var x = xy % dim, y = ((xy - x) / dim) % dim;
    var w = Math.floor(xy / (dim * dim));
    if (w % 2 !== 0) w = w * -1 - 1;
    w /= 2;
    return new TileCoord(z, x, y, w, sourceMaxZoom);
};

// given a list of urls, choose a url template and return a tile URL
TileCoord.prototype.url = function(urls) {
    return urls[(this.x + this.y) % urls.length]
        .replace('{prefix}', (this.x % 16).toString(16) + (this.y % 16).toString(16))
        .replace('{z}', this.dataZ)
        .replace('{x}', this.x)
        .replace('{y}', this.y);
};

// Return the coordinate of the parent tile
TileCoord.prototype.parent = function() {
    if (this.z === 0) return null;

    // the id represents an overscaled tile, return the same coordinates with a lower z
    if (this.z > this.dataZ) {
        return new TileCoord(this.z - 1, this.x, this.y, this.w, this.sourceMaxZoom);
    }

    return new TileCoord(this.z - 1, Math.floor(this.x / 2), Math.floor(this.y / 2), this.w, this.sourceMaxZoom);
};

TileCoord.prototype.wrapped = function() {
    return new TileCoord(this.z, this.x, this.y, 0, this.sourceMaxZoom);
};

// Return the coordinates of the tile's children
TileCoord.prototype.children = function() {

    if (this.z >= this.sourceMaxZoom) {
        // return a single tile coord representing a an overscaled tile
        return [new TileCoord(this.z + 1, this.x, this.y, this.w, this.sourceMaxZoom)];
    }

    var z = this.z + 1;
    var x = this.x * 2;
    var y = this.y * 2;
    return [
        new TileCoord(z, x, y, this.w, this.sourceMaxZoom),
        new TileCoord(z, x + 1, y, this.w, this.sourceMaxZoom),
        new TileCoord(z, x, y + 1, this.w, this.sourceMaxZoom),
        new TileCoord(z, x + 1, y + 1, this.w, this.sourceMaxZoom)
    ];
};
