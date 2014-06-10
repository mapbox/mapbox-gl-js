'use strict';

var Tile = require('./tile.js'),
    LineVertexBuffer = require('../geometry/linevertexbuffer.js'),
    LineElementBuffer = require('../geometry/lineelementbuffer.js'),
    FillVertexBuffer = require('../geometry/fillvertexbuffer.js'),
    FillElementsBuffer = require('../geometry/fillelementsbuffer.js'),
    GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js'),
    PointVertexBuffer = require('../geometry/pointvertexbuffer.js'),
    Bucket = require('../geometry/bucket.js'),
    util = require('../util/util.js');

module.exports = VectorTile;

function VectorTile(id, source, url, callback) {
    this.id = id;
    this.loaded = false;
    this.url = url;
    this.zoom = Tile.fromID(id).z;
    this.map = source.map;
    this.source = source;
    this.id = util.uniqueId();
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
        tileSize: this.source.tileSize,
        template: this.source.options.url,
        glyphs: this.source.options.glyphs
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
    for (var id in data.buckets) {
        var layer = data.buckets[id];
        var defaultStyle = this.map.style.stylesheet.styles.default[id];
        this.buckets[id] = {};
        for (var b in layer) {
            this.buckets[id][b] = new Bucket(defaultStyle, b, this.geometry, undefined, layer[b].indices);
        }
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
