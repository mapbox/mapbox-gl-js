'use strict';

var rbush = require('rbush');
var Point = require('point-geometry');
var vt = require('vector-tile');
var util = require('../util/util');

module.exports = FeatureTree;

function FeatureTree(coord, overscaling) {
    this.x = coord.x;
    this.y = coord.y;
    this.z = coord.z - Math.log(overscaling) / Math.LN2;
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
        x = args.x,
        y = args.y,
        result = [];

    var radius, bounds;
    if (typeof x !== 'undefined' && typeof y !== 'undefined') {
        // a point (or point+radius) query
        radius = (params.radius || 0) * (args.tileExtent || 4096) / args.scale;
        bounds = [x - radius, y - radius, x + radius, y + radius];
    } else {
        // a rectangle query
        bounds = [ args.minX, args.minY, args.maxX, args.maxY ];
    }

    var matching = this.rtree.search(bounds);
    for (var i = 0; i < matching.length; i++) {
        var feature = matching[i].feature,
            layers = matching[i].layers,
            type = vt.VectorTileFeature.types[feature.type];

        if (params.$type && type !== params.$type)
            continue;
        if (radius && !geometryContainsPoint(feature.loadGeometry(), type, new Point(x, y), radius))
            continue;
        else if (!geometryIntersectsBox(feature.loadGeometry(), type, bounds))
            continue;

        var geoJSON = feature.toGeoJSON(this.x, this.y, this.z);

        if (!params.includeGeometry) {
            geoJSON.geometry = null;
        }

        for (var l = 0; l < layers.length; l++) {
            var layer = layers[l];

            if (params.layerIds && params.layerIds.indexOf(layer) < 0)
                continue;

            result.push(util.extend({layer: layer}, geoJSON));
        }
    }
    callback(null, result);
};

function geometryIntersectsBox(rings, type, bounds) {
    return type === 'Point' ? pointIntersectsBox(rings, bounds) :
           type === 'LineString' ? lineIntersectsBox(rings, bounds) :
           type === 'Polygon' ? polyIntersectsBox(rings, bounds) || lineIntersectsBox(rings, bounds) : false;
}

// Tests whether any of the four corners of the bbox are contained in the
// interior of the polygon.  Otherwise, defers to lineIntersectsBox.
function polyIntersectsBox(rings, bounds) {
    if (polyContainsPoint(rings, new Point(bounds[0], bounds[1])) ||
        polyContainsPoint(rings, new Point(bounds[0], bounds[3])) ||
        polyContainsPoint(rings, new Point(bounds[2], bounds[1])) ||
        polyContainsPoint(rings, new Point(bounds[2], bounds[3])))
        return true;

    return lineIntersectsBox(rings, bounds);
}

// Only needs to cover the case where the line crosses the bbox boundary.
// Otherwise, pointIntersectsBox should have us covered.
function lineIntersectsBox(rings, bounds) {
    for (var k = 0; k < rings.length; k++) {
        var ring = rings[k];
        for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            var p0 = ring[i];
            var p1 = ring[j];

            // invert the segment so as to reuse segmentCrossesHorizontal for
            // checking whether it crosses the vertical sides of the bbox.
            var i0 = new Point(p0.y, p0.x);
            var i1 = new Point(p1.y, p1.x);

            if (segmentCrossesHorizontal(p0, p1, bounds[0], bounds[2], bounds[1]) ||
                segmentCrossesHorizontal(p0, p1, bounds[0], bounds[2], bounds[3]) ||
                segmentCrossesHorizontal(i0, i1, bounds[1], bounds[3], bounds[0]) ||
                segmentCrossesHorizontal(i0, i1, bounds[1], bounds[3], bounds[2]))
                return true;
        }
    }

    return pointIntersectsBox(rings, bounds);
}

/*
 * Answer whether segment p1-p2 intersects with (x1, y)-(x2, y)
 * Assumes x2 >= x1
 */
function segmentCrossesHorizontal(p0, p1, x1, x2, y) {
    if (p1.y === p0.y)
        return p1.y === y &&
            Math.min(p0.x, p1.x) <= x2 &&
            Math.max(p0.x, p1.x) >= x1;

    var r = (y - p0.y) / (p1.y - p0.y);
    var x = p0.x + r * (p1.x - p0.x);
    return (x >= x1 && x <= x2 && r <= 1 && r >= 0);
}

function pointIntersectsBox(rings, bounds) {
    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 0; j < ring.length; j++) {
            if (ring[j].x >= bounds[0] &&
                ring[j].y >= bounds[1] &&
                ring[j].x <= bounds[2] &&
                ring[j].y <= bounds[3]) return true;
        }
    }
    return false;
}

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
