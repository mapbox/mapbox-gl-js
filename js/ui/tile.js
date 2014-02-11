'use strict';

var LineVertexBuffer = require('../geometry/linevertexbuffer.js');
var FillVertexBuffer = require('../geometry/fillvertexbuffer.js');
var FillElementsBuffer = require('../geometry/fillelementsbuffer.js');
var GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js');

var glmatrix = require('../lib/glmatrix.js');
var mat4 = glmatrix.mat4;
var vec2 = glmatrix.vec2;

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

Tile.prototype.positionAt = function(id, clickX, clickY) {
    var tilePos = Tile.fromID(id);
    var z = tilePos.z, x = tilePos.x, y = tilePos.y, w = tilePos.w;
    x += w * (1 << z);

    // Calculate the transformation matrix for this tile.
    // TODO: We should calculate this once because we do the same thing in
    // the painter as well.
    var transform = this.map.transform;
    var tileSize = this.map.transform.tileSize;

    var tileScale = Math.pow(2, z);
    var scale = transform.scale * tileSize / tileScale;

    // Use 64 bit floats to avoid precision issues.
    var posMatrix = new Float64Array(16);
    mat4.identity(posMatrix);

    mat4.translate(posMatrix, posMatrix, transform.centerOrigin);
    mat4.rotateZ(posMatrix, posMatrix, transform.angle);
    mat4.translate(posMatrix, posMatrix, transform.icenterOrigin);
    mat4.translate(posMatrix, posMatrix, [ transform.x, transform.y, 0 ]);
    mat4.translate(posMatrix, posMatrix, [ scale * x, scale * y, 0 ]);

    // Calculate the inverse matrix so that we can project the screen position
    // back to the source position.
    var invPosMatrix = new Float64Array(16);
    mat4.invert(invPosMatrix, posMatrix);

    var pos = vec2.transformMat4([], [clickX, clickY], invPosMatrix);
    vec2.scale(pos, pos, 4096 / scale);
    return {
        x: pos[0],
        y: pos[1],
        scale: scale
    };
};

Tile.prototype.featuresAt = function(pos, params, callback) {
    this.map.dispatcher.send('query features', {
        id: this.id,
        x: pos.x,
        y: pos.y,
        scale: pos.scale,
        params: params
    }, callback, this.workerID);

};

Tile.prototype.onTileLoad = function(data) {
    this.geometry = data.geometry;
    this.layers = data.layers;
    this.stats = data.stats;

    this.geometry.glyphVertex = new GlyphVertexBuffer(this.geometry.glyphVertex);
    this.geometry.lineVertex = new LineVertexBuffer(this.geometry.lineVertex);
    this.geometry.fillBuffers.forEach(function(d) {
        d.vertex = new FillVertexBuffer(d.vertex);
        d.elements = new FillElementsBuffer(d.elements);
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
