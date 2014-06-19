'use strict';

var Tile = require('./tile.js');
var LineVertexBuffer = require('../geometry/linevertexbuffer.js');
var LineElementBuffer = require('../geometry/lineelementbuffer.js');
var FillVertexBuffer = require('../geometry/fillvertexbuffer.js');
var FillElementBuffer = require('../geometry/fillelementsbuffer.js');
var GlyphVertexBuffer = require('../geometry/glyphvertexbuffer.js');
var PointVertexBuffer = require('../geometry/pointvertexbuffer.js');
var createBucket = require('../geometry/createbucket.js');

module.exports = GeoJSONTile;

function GeoJSONTile(id, source, data) {
    this.id = id;
    this.source = source;
    this.data = data;
}

GeoJSONTile.prototype = Object.create(Tile);

GeoJSONTile.prototype._load = function() {
    if (this.loaded) return;
    this.loaded = true;

    var data = this.data;
    this.buffers = data.buffers;
    this.buffers.glyphVertex = new GlyphVertexBuffer(this.buffers.glyphVertex);
    this.buffers.pointVertex = new PointVertexBuffer(this.buffers.pointVertex);
    this.buffers.lineVertex = new LineVertexBuffer(this.buffers.lineVertex);
    this.buffers.lineElement = new LineElementBuffer(this.buffers.lineElement);
    this.buffers.fillVertex = new FillVertexBuffer(this.buffers.fillVertex);
    this.buffers.fillElement = new FillElementBuffer(this.buffers.fillElement);

    this.buckets = {};
    for (var b in data.elementGroups) {
        this.buckets[b] = createBucket(this.source.map.style.buckets[b].render, undefined, data.elementGroups[b], this.buffers);
    }


};

// noops
GeoJSONTile.prototype.abort = function() { };
GeoJSONTile.prototype.remove = function() { };

/*
GeoJSONTile.prototype.featuresAt = function(pos, params, callback) {
    this.featureTree.query({
        id: this.id,
        x: pos.x,
        y: pos.y,
        scale: pos.scale,
        params: params
    }, callback);
};
*/
