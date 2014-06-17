'use strict';

var Tile = require('./tile.js'),
    LineVertexBuffer = require('../geometry/linevertexbuffer.js'),
    LineElementBuffer = require('../geometry/lineelementbuffer.js'),
    FillVertexBuffer = require('../geometry/fillvertexbuffer.js'),
    FillElementBuffer = require('../geometry/fillelementsbuffer.js'),
    GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js'),
    PointVertexBuffer = require('../geometry/pointvertexbuffer.js'),
    util = require('../util/util.js');

var createBucket = require('../geometry/createbucket.js');

module.exports = VectorTile;

function VectorTile(id, source, url, callback) {
    this.id = id;
    this.loaded = false;
    this.url = url;
    this.zoom = Tile.fromID(id).z;
    this.map = source.map;
    this.options = source.options;
    this.id = util.uniqueId();
    this.callback = callback;
    this.source = source;
    this.uses = 1;
    this._load();
}

VectorTile.prototype = Object.create(Tile);

VectorTile.prototype._load = function() {
    var tile = this;
    this.workerID = this.map.dispatcher.send('load tile', {
        url: this.url,
        id: this.id,
        zoom: this.zoom,
        tileSize: this.options.tileSize,
        glyphs: this.options.glyphs,
        source: this.source.id
    }, function(err, data) {
        if (!err && data) {
            tile.onTileLoad(data);
        }
        tile.callback(err);
    });
};

VectorTile.prototype.featuresAt = function(pos, params, callback) {
    this.map.dispatcher.send('query features', {
        id: this.id,
        x: pos.x,
        y: pos.y,
        scale: pos.scale,
        params: params
    }, callback, this.workerID);

};

VectorTile.prototype.onTileLoad = function(data) {

    // Tile has been removed from the map
    if (!this.map) return;

    this.buffers = data.buffers;
    this.buffers.glyphVertex = new GlyphVertexBuffer(this.buffers.glyphVertex);
    this.buffers.pointVertex = new PointVertexBuffer(this.buffers.pointVertex);
    this.buffers.lineVertex = new LineVertexBuffer(this.buffers.lineVertex);
    this.buffers.lineElement = new LineElementBuffer(this.buffers.lineElement);
    this.buffers.fillVertex = new FillVertexBuffer(this.buffers.fillVertex);
    this.buffers.fillElement = new FillElementBuffer(this.buffers.fillElement);

    this.buckets = {};
    for (var b in data.elementGroups) {
        this.buckets[b] = createBucket(this.map.style.stylesheet.buckets[b], undefined, data.elementGroups[b], this.buffers);
    }

    this.loaded = true;
};

VectorTile.prototype.remove = function() {
    this.map.dispatcher.send('remove tile', this.id, null, this.workerID);
    this.map.painter.glyphAtlas.removeGlyphs(this.id);

    if (this.geometry) {
        var gl = this.map.painter.gl;
        var geometry = this.geometry;

        geometry.glyphVertex.destroy(gl);
        geometry.pointVertex.destroy(gl);

        for (var i = 0; i <= geometry.fillBufferIndex; i++) {
            geometry.fillBuffers[i].vertex.destroy(gl);
            geometry.fillBuffers[i].elements.destroy(gl);
        }
        for (var k = 0; k <= geometry.lineBufferIndex; k++) {
            geometry.lineBuffers[k].vertex.destroy(gl);
            geometry.lineBuffers[k].element.destroy(gl);
        }

    }
    delete this.map;
};

VectorTile.prototype.abort = function() {
    this.map.dispatcher.send('abort tile', this.id, null, this.workerID);
};
