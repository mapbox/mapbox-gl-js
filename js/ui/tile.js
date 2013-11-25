'use strict';

var VertexBuffer = require('../geometry/vertexbuffer.js');
var FillBuffer = require('../geometry/fillbuffer.js');
var GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js');

/*
 * Tiles are generally represented as packed integer ids constructed by
 * `Tile.toID(x, y, z)`
 */

/*
 * Dispatch a tile load request
 */

module.exports = Tile;
function Tile(map, url, zoom, callback) {
    this.loaded = false;
    this.id = map.getUUID();
    this.url = url;
    this.zoom = zoom;
    this.map = map;
    this._load();
    this.callback = callback;
    this.uses = 1;
}

Tile.prototype._load = function() {
    var tile = this;
    this.workerID = this.map.dispatcher.send('load tile', {
        url: this.url,
        id: this.id,
        zoom: this.zoom
    }, function(err, data) {
        if (!err && data) {
            tile.onTileLoad(data);
        }
        tile.callback(err);
    });
};

// Tile.prototype.stats = function(callback) {
//     var tile = this;
//     if (this._stats) {
//         callback(null, this._stats);
//     } else {
//         this.map.dispatcher.send('list layers', this.id, function(err, data) {
//             tile._stats = data;
//             callback(err, data);
//         }, this.workerID);
//     }
// };

Tile.prototype.onTileLoad = function(data) {
    this.geometry = data.geometry;
    this.layers = data.layers;
    this.stats = data.stats;

    this.geometry.glyph = new GlyphVertexBuffer(this.geometry.glyph);
    this.geometry.buffers.forEach(function(d) {
        d.vertex = new VertexBuffer(d.vertex);
        d.fill = new FillBuffer(d.fill);
    });

    this.loaded = true;
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

/*
 * Given an id and a list of urls, choose a url template and return a tile
 * URL
 */
Tile.url = function(id, urls) {
    var pos = Tile.fromID(id);
    return urls[((pos.x + pos.y) % urls.length) | 0]
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

Tile.prototype.remove = function() {
    this.map.dispatcher.send('remove tile', this.id, null, this.workerID);
    this.map.painter.glyphAtlas.removeGlyphs(this.id);
    delete this.map;
};

Tile.prototype.abort = function() {
    this.map.dispatcher.send('abort tile', this.id, null, this.workerID);
};
