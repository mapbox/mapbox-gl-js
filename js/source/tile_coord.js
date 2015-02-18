'use strict';

/*
 * Tiles are generally represented as packed integer ids constructed by
 * `TileCoord.toID(x, y, z)`
 */

var TileCoord = exports;

TileCoord.toID = function(z, x, y, w) {
    w = w || 0;
    w *= 2;
    if (w < 0) w = w * -1 - 1;
    var dim = 1 << z;
    return ((dim * dim * w + dim * y + x) * 32) + z;
};

TileCoord.asString = function(id) {
    var pos = TileCoord.fromID(id);
    return pos.z + "/" + pos.x + "/" + pos.y;
};

/*
 * Parse a packed integer id into an object with x, y, and z properties
 */
TileCoord.fromID = function(id) {
    var z = id % 32, dim = 1 << z;
    var xy = ((id - z) / 32);
    var x = xy % dim, y = ((xy - x) / dim) % dim;
    var w = Math.floor(xy / (dim * dim));
    if (w % 2 !== 0) w = w * -1 - 1;
    w /= 2;
    return { z: z, x: x, y: y, w: w };
};

/*
 * Given a packed integer id, return its zoom level
 */
TileCoord.zoom = function(id) {
    return id % 32;
};

// Given an id and a list of urls, choose a url template and return a tile URL
TileCoord.url = function(id, urls, sourceMaxZoom) {
    var pos = TileCoord.fromID(id);

    return urls[(pos.x + pos.y) % urls.length]
        .replace('{prefix}', (pos.x % 16).toString(16) + (pos.y % 16).toString(16))
        .replace('{z}', Math.min(pos.z, sourceMaxZoom || pos.z))
        .replace('{x}', pos.x)
        .replace('{y}', pos.y);
};

/*
 * Given a packed integer id, return the id of its parent tile
 */
TileCoord.parent = function(id, sourceMaxZoom) {
    var pos = TileCoord.fromID(id);
    if (pos.z === 0) return null;

    // the id represents an overscaled tile, return the same coordinates with a lower z
    if (pos.z > sourceMaxZoom) {
        return TileCoord.toID(pos.z - 1, pos.x, pos.y, pos.w);
    }

    return TileCoord.toID(pos.z - 1, Math.floor(pos.x / 2), Math.floor(pos.y / 2), pos.w);
};

TileCoord.parentWithZoom = function(id, zoom) {
    var pos = TileCoord.fromID(id);
    while (pos.z > zoom) {
        pos.z--;
        pos.x = Math.floor(pos.x / 2);
        pos.y = Math.floor(pos.y / 2);
    }
    return TileCoord.toID(pos.z, pos.x, pos.y, pos.w);
};

/*
 * Given a packed integer id, return an array of integer ids representing
 * its four children.
 */
TileCoord.children = function(id, sourceMaxZoom) {
    var pos = TileCoord.fromID(id);

    if (pos.z >= sourceMaxZoom) {
        // return a single tile id representing a an overscaled tile
        return [TileCoord.toID(pos.z + 1, pos.x, pos.y, pos.w)];
    }

    pos.z += 1;
    pos.x *= 2;
    pos.y *= 2;
    return [
        TileCoord.toID(pos.z, pos.x, pos.y, pos.w),
        TileCoord.toID(pos.z, pos.x + 1, pos.y, pos.w),
        TileCoord.toID(pos.z, pos.x, pos.y + 1, pos.w),
        TileCoord.toID(pos.z, pos.x + 1, pos.y + 1, pos.w)
    ];
};

TileCoord.zoomTo = function(c, z) {
    c.column = c.column * Math.pow(2, z - c.zoom);
    c.row = c.row * Math.pow(2, z - c.zoom);
    c.zoom = z;
    return c;
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

TileCoord.cover = function(z, bounds, actualZ) {
    var tiles = 1 << z;
    var t = {};

    function scanLine(x0, x1, y) {
        var x, wx;
        if (y >= 0 && y <= tiles) {
            for (x = x0; x < x1; x++) {
                wx = (x + tiles) % tiles;
                t[TileCoord.toID(actualZ, wx, y, Math.floor(x / tiles))] = {x: wx, y: y};
            }
        }
    }

    // Divide the screen up in two triangles and scan each of them:
    // +---/
    // | / |
    // /---+
    scanTriangle(bounds[0], bounds[1], bounds[2], 0, tiles, scanLine);
    scanTriangle(bounds[2], bounds[3], bounds[0], 0, tiles, scanLine);

    return Object.keys(t);
};
