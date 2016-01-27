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

// Taken from polymaps src/Layer.js
// https://github.com/simplegeo/polymaps/blob/master/src/Layer.js#L333-L383

function edge(a, b) {
    if (a.row > b.row) { var t = a; a = b; b = t; }
    return {
        x0: a.column,
        y0: a.row,
        x1: b.column,
        y1: b.row,
        dx: b.column - a.column,
        dy: b.row - a.row
    };
}

function scanSpans(e0, e1, ymin, ymax, scanLine) {
    var y0 = Math.max(ymin, Math.floor(e1.y0));
    var y1 = Math.min(ymax, Math.ceil(e1.y1));

    // sort edges by x-coordinate
    if ((e0.x0 === e1.x0 && e0.y0 === e1.y0) ?
            (e0.x0 + e1.dy / e0.dy * e0.dx < e1.x1) :
            (e0.x1 - e1.dy / e0.dy * e0.dx < e1.x0)) {
        var t = e0; e0 = e1; e1 = t;
    }

    // scan lines!
    var m0 = e0.dx / e0.dy;
    var m1 = e1.dx / e1.dy;
    var d0 = e0.dx > 0; // use y + 1 to compute x0
    var d1 = e1.dx < 0; // use y + 1 to compute x1
    for (var y = y0; y < y1; y++) {
        var x0 = m0 * Math.max(0, Math.min(e0.dy, y + d0 - e0.y0)) + e0.x0;
        var x1 = m1 * Math.max(0, Math.min(e1.dy, y + d1 - e1.y0)) + e1.x0;
        scanLine(Math.floor(x1), Math.ceil(x0), y);
    }
}

function scanTriangle(a, b, c, ymin, ymax, scanLine) {
    var ab = edge(a, b),
        bc = edge(b, c),
        ca = edge(c, a);

    var t;

    // sort edges by y-length
    if (ab.dy > bc.dy) { t = ab; ab = bc; bc = t; }
    if (ab.dy > ca.dy) { t = ab; ab = ca; ca = t; }
    if (bc.dy > ca.dy) { t = bc; bc = ca; ca = t; }

    // scan span! scan span!
    if (ab.dy) scanSpans(ca, ab, ymin, ymax, scanLine);
    if (bc.dy) scanSpans(ca, bc, ymin, ymax, scanLine);
}

TileCoord.cover = function(zoom, bounds, sourceMaxZoom, loadOverscaled) {
    var z = Math.min(zoom, sourceMaxZoom);
    var styleZ = loadOverscaled ? zoom : z;
    var tiles = 1 << z;
    var t = {};

    function scanLine(x0, x1, y) {
        var x, wx, coord;
        if (y >= 0 && y <= tiles) {
            for (x = x0; x < x1; x++) {
                wx = (x % tiles + tiles) % tiles;
                coord = new TileCoord(styleZ, wx, y, Math.floor(x / tiles), sourceMaxZoom);
                t[coord.id] = coord;
            }
        }
    }

    // Divide the screen up in two triangles and scan each of them:
    // +---/
    // | / |
    // /---+
    scanTriangle(bounds[0], bounds[1], bounds[2], 0, tiles, scanLine);
    scanTriangle(bounds[2], bounds[3], bounds[0], 0, tiles, scanLine);

    return Object.keys(t).map(function(id) {
        return t[id];
    });
};
