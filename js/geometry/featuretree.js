'use strict';

var rbush = require('rbush');
var util = require('../util/util.js');

module.exports = FeatureTree;

function FeatureTree(getGeometry, getType) {

    this.getGeometry = getGeometry;
    this.getType = getType;

    this.rtree = rbush(9);
    this.toBeInserted = [];
}

FeatureTree.prototype.insert = function(bbox, bucket_name, feature) {
    bbox.bucket = bucket_name;
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

    var radius = 0;
    if ('radius' in args.params) {
        radius = args.params.radius;
    }

    radius *= 4096 / args.scale;

    // console.warn(args.scale);
    // var radius = 0;
    var x = args.x;
    var y =  args.y;

    var matching = this.rtree.search([ x - radius, y - radius, x + radius, y + radius ]);

    if (args.params.buckets) {
        this.queryBuckets(matching, x, y, radius, args.params, callback);
    } else {
        this.queryFeatures(matching, x, y, radius, args.params, callback);
    }
};

FeatureTree.prototype.queryFeatures = function(matching, x, y, radius, params, callback) {
    var result = [];
    for (var i = 0; i < matching.length; i++) {
        var feature = matching[i].feature;
        var type = this.getType(feature);
        var geometry = this.getGeometry(feature);


        if (params.bucket && matching[i].bucket !== params.bucket) continue;
        if (params.type && type !== params.type) continue;

        if (geometryContainsPoint(geometry, type, { x: x, y: y }, radius)) {
            var props = {
                _bucket: matching[i].bucket,
                _type: type
            };

            if (params.geometry) {
                props._geometry = geometry;
            }

            for (var key in feature) {
                if (feature.hasOwnProperty(key) && key[0] !== '_') {
                    props[key] = feature[key];
                }
            }
            result.push(props);
        }
    }

    callback(null, result);
};

// Lists all buckets that at the position.
FeatureTree.prototype.queryBuckets = function(matching, x, y, radius, params, callback) {
    var buckets = [];
    for (var i = 0; i < matching.length; i++) {
        if (buckets.indexOf(matching[i].bucket) >= 0) continue;

        var feature = matching[i].feature;
        var type = this.getType(feature);
        var geometry = this.getGeometry(feature);
        if (geometryContainsPoint(geometry, type, { x: x, y: y }, radius)) {
            buckets.push(matching[i].bucket);
        }
    }

    callback(null, buckets);
};


function geometryContainsPoint(rings, type, p, radius) {
    if (type === 'point') {
        return pointContainsPoint(rings, p, radius);
    } else if (type === 'line') {
        return lineContainsPoint(rings, p, radius);
    } else if (type === 'fill') {
        return polyContainsPoint(rings, p) ? true : lineContainsPoint(rings, p, radius);
    } else {
        return false;
    }
}

// Code from http://stackoverflow.com/a/1501725/331379.
function sqr(x) { return x * x; }
function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y); }
function distToSegmentSquared(p, v, w) {
  var l2 = dist2(v, w);
  if (l2 === 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  if (t < 0) return dist2(p, v);
  if (t > 1) return dist2(p, w);
  return dist2(p, { x: v.x + t * (w.x - v.x),
                    y: v.y + t * (w.y - v.y) });
}

function lineContainsPoint(rings, p, radius) {
    var r = radius * radius;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 1; j < ring.length; j++) {
            // Find line segments that have a distance <= radius^2 to p
            // In that case, we treat the line as "containing point p".
            var v = ring[j-1], w = ring[j];
            if (distToSegmentSquared(p, v, w) < r) return true;
        }
    }
    return false;
}

function polyContainsPoint(rings, p) {
    var vert = rings[0];
    if (rings.length > 1) {
        // Convert the rings to a single 0,0 separated list.
        var O = { x: 0, y: 0 };
        vert = [O];
        for (var k = 0; k < rings.length; k++) {
            vert.push.apply(vert, rings[k]);
            vert.push(O);
        }
    }

    // Point in polygon test from
    // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
    var c = false;
    for (var i = 0, j = vert.length - 1; i < vert.length; j = i++) {
        if (((vert[i].y > p.y) != (vert[j].y > p.y)) &&
            (p.x < (vert[j].x - vert[i].x) * (p.y - vert[i].y) / (vert[j].y - vert[i].y) + vert[i].x)) {
            c = !c;
        }
    }
    return c;
}

function pointContainsPoint(rings, p, radius) {
    var r = radius * radius;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var j = 0; j < ring.length; j++) {
            if (util.distSqr(ring[j], p) <= r) return true;
        }
    }
    return false;
}


