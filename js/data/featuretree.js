'use strict';

var rbush = require('rbush'),
    Point = require('point-geometry');

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

        if (geometryContainsPoint(geometry, type, new Point(x, y), radius)) {
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
        if (geometryContainsPoint(geometry, type, new Point(x, y), radius)) {
            buckets.push(matching[i].bucket);
        }
    }

    callback(null, buckets);
};


function geometryContainsPoint(rings, type, p, radius) {
    if (type === 'Point') {
        return pointContainsPoint(rings, p, radius);
    } else if (type === 'LineString') {
        return lineContainsPoint(rings, p, radius);
    } else if (type === 'Polygon') {
        return polyContainsPoint(rings, p) ? true : lineContainsPoint(rings, p, radius);
    } else {
        return false;
    }
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
            var v = ring[j-1], w = ring[j];
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
            if (((p1.y > p.y) != (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
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


