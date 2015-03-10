'use strict';

var rbush = require('rbush');
var Point = require('point-geometry');
var vt = require('vector-tile');
var util = require('../util/util');
var TileCoord = require('../source/tile_coord');

module.exports = FeatureTree;

function FeatureTree(tileId) {
    this.coord = TileCoord.fromID(tileId);
    this.rtree = rbush(9);
    this.toBeInserted = [];
}

FeatureTree.prototype.insert = function(bbox, layers, feature) {
    bbox.layers = layers;
    bbox.feature = feature;
    this.toBeInserted.push(bbox);
};

// bulk insert into tree
FeatureTree.prototype._load = function() {
    this.rtree.load(this.toBeInserted);
    this.toBeInserted = [];
};

// Finds features in this tile at a particular position.
FeatureTree.prototype.query = function(args, callback) {
    if (this.toBeInserted.length) this._load();

    var params = args.params || {},
        radius = (params.radius || 0) * 4096 / args.scale,
        x = args.x,
        y = args.y,
        result = [];

    var matching = this.rtree.search([ x - radius, y - radius, x + radius, y + radius ]);
    for (var i = 0; i < matching.length; i++) {
        var feature = matching[i].feature,
            layers = matching[i].layers,
            type = vt.VectorTileFeature.types[feature.type];

        if (params.$type && type !== params.$type)
            continue;
        if (!geometryContainsPoint(feature.loadGeometry(), type, new Point(x, y), radius))
            continue;

        var geoJSON = feature.toGeoJSON(this.coord.x, this.coord.y, this.coord.z);
        for (var l = 0; l < layers.length; l++) {
            var layer = layers[l];

            if (params.layer && layer !== params.layer.id)
                continue;

            result.push(util.extend({layer: layer}, geoJSON));
        }
    }

    callback(null, result);
};

function geometryContainsPoint(rings, type, p, radius) {
    return type === 'Point' ? pointContainsPoint(rings, p, radius) :
           type === 'LineString' ? lineContainsPoint(rings, p, radius) :
           type === 'Polygon' ? polyContainsPoint(rings, p) || lineContainsPoint(rings, p, radius) : false;
}

// Code from http://stackoverflow.com/a/1501725/331379.
function distToSegmentSquared(p, v, w) {
    var l2 = v.distSqr(w);
    if (l2 === 0) return p.distSqr(v);
    var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    if (t < 0) return p.distSqr(v);
    if (t > 1) return p.distSqr(w);
    return p.distSqr(w.sub(v)._mult(t)._add(v));
}

function lineContainsPoint(rings, p, radius) {
    var r = radius * radius;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 1; j < ring.length; j++) {
            // Find line segments that have a distance <= radius^2 to p
            // In that case, we treat the line as "containing point p".
            var v = ring[j - 1], w = ring[j];
            if (distToSegmentSquared(p, v, w) < r) return true;
        }
    }
    return false;
}

// point in polygon ray casting algorithm
function polyContainsPoint(rings, p) {
    var c = false,
        ring, p1, p2;

    for (var k = 0; k < rings.length; k++) {
        ring = rings[k];
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            p1 = ring[i];
            p2 = ring[j];
            if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
                c = !c;
            }
        }
    }
    return c;
}

function pointContainsPoint(rings, p, radius) {
    var r = radius * radius;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 0; j < ring.length; j++) {
            if (ring[j].distSqr(p) <= r) return true;
        }
    }
    return false;
}
