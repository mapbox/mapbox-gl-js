'use strict';

var Tile = require('./tile.js');
var LineVertexBuffer = require('../geometry/linevertexbuffer.js');
var LineElementBuffer = require('../geometry/lineelementbuffer.js');
var FillVertexBuffer = require('../geometry/fillvertexbuffer.js');
var FillElementsBuffer = require('../geometry/fillelementsbuffer.js');
var GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js');
var PointVertexBuffer = require('../geometry/pointvertexbuffer.js');
var Bucket = require('../geometry/bucket.js');

module.exports = VectorTile;

function VectorTile(source, url, zoom, callback) {
    this.loaded = false;
    this.url = url;
    this.zoom = zoom;
    this.map = source.map;
    this.source = source;
    this.id = this.map.getUUID();
    this._load();
    this.callback = callback;
    this.uses = 1;
}

VectorTile.prototype = Object.create(Tile);

VectorTile.prototype._load = function() {
    var tile = this;
    this.workerID = this.map.dispatcher.send('load tile', {
        url: this.url,
        id: this.id,
        zoom: this.zoom,
        tileSize: this.source.tileSize
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

    this.geometry = data.geometry;

    this.geometry.glyphVertex = new GlyphVertexBuffer(this.geometry.glyphVertex);
    this.geometry.pointVertex = new PointVertexBuffer(this.geometry.pointVertex);
    this.geometry.lineBuffers.forEach(function(d) {
        d.vertex = new LineVertexBuffer(d.vertex);
        d.element = new LineElementBuffer(d.element);
    });
    this.geometry.fillBuffers.forEach(function(d) {
        d.vertex = new FillVertexBuffer(d.vertex);
        d.elements = new FillElementsBuffer(d.elements);
    });

    this.buckets = {};
    for (var b in data.buckets) {
        this.buckets[b] = new Bucket(this.map.style.stylesheet.buckets[b], this.geometry, undefined, data.buckets[b].indices);
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
