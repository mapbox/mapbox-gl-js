'use strict';

/*
 * Tiles are generally represented as packed integer ids constructed by
 * `TileCoord.toID(x, y, z)`
 */

var TileCoord = exports;

TileCoord.toID = function(z, x, y, w) {
    w = w || 0;
    w *= 2;
    if (w < 0) w = w * -1 -1;
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
    if (w % 2 !== 0) w = w * -1 -1;
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
TileCoord.url = function(id, urls) {
    var pos = TileCoord.fromID(id);

    return urls[Math.floor((pos.x + pos.y) % urls.length)]
        .replace('{h}', (pos.x % 16).toString(16) + (pos.y % 16).toString(16))
        .replace('{z}', pos.z.toFixed(0))
        .replace('{x}', pos.x.toFixed(0))
        .replace('{y}', pos.y.toFixed(0));
};

/*
 * Given a packed integer id, return the id of its parent tile
 */
TileCoord.parent = function(id) {
    var pos = TileCoord.fromID(id);
    if (pos.z === 0) return id;
    else return TileCoord.toID(pos.z - 1, Math.floor(pos.x / 2), Math.floor(pos.y / 2));
};

TileCoord.parentWithZoom = function(id, zoom) {
    var pos = TileCoord.fromID(id);
    while (pos.z > zoom) {
        pos.z--;
        pos.x = Math.floor(pos.x / 2);
        pos.y = Math.floor(pos.y / 2);
    }
    return TileCoord.toID(pos.z, pos.x, pos.y);
};

/*
 * Given a packed integer id, return an array of integer ids representing
 * its four children.
 */
TileCoord.children = function(id) {
    var pos = TileCoord.fromID(id);
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

