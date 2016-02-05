'use strict';

var rbush = require('rbush');
var Point = require('point-geometry');
var vt = require('vector-tile');
var util = require('../util/util');
var loadGeometry = require('./load_geometry');
var EXTENT = require('./bucket').EXTENT;
var CollisionBox = require('../symbol/collision_box');

module.exports = FeatureTree;

function FeatureTree(coord, overscaling, collisionTile) {
    this.x = coord.x;
    this.y = coord.y;
    this.z = coord.z - Math.log(overscaling) / Math.LN2;
    this.rtree = rbush(9);
    this.toBeInserted = [];
    this.setCollisionTile(collisionTile);
}

FeatureTree.prototype.insert = function(bbox, layerIDs, feature) {
    var scale = EXTENT / feature.extent;
    bbox[0] *= scale;
    bbox[1] *= scale;
    bbox[2] *= scale;
    bbox[3] *= scale;
    bbox.layerIDs = layerIDs;
    bbox.feature = feature;
    this.toBeInserted.push(bbox);
};

// bulk insert into tree
FeatureTree.prototype._load = function() {
    this.rtree.load(this.toBeInserted);
    this.toBeInserted = [];
};

FeatureTree.prototype.setCollisionTile = function(collisionTile) {
    this.collisionTile = collisionTile;
};

function translateDistance(translate) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

// Finds features in this tile at a particular position.
FeatureTree.prototype.query = function(args, styleLayersByID) {
    if (this.toBeInserted.length) this._load();

    var params = args.params || {},
        x = args.x,
        y = args.y,
        p = new Point(x, y),
        pixelsToTileUnits = EXTENT / args.tileSize / args.scale,
        result = [];

    // Features are indexed their original geometries. The rendered geometries may
    // be buffered, translated or offset. Figure out how much the search radius needs to be
    // expanded by to include these features.
    var additionalRadius = 0;
    var styleLayer;
    for (var id in styleLayersByID) {
        styleLayer = styleLayersByID[id];

        var styleLayerDistance = 0;
        if (styleLayer.type === 'line') {
            styleLayerDistance = styleLayer.paint['line-width'] / 2 + Math.abs(styleLayer.paint['line-offset']) + translateDistance(styleLayer.paint['line-translate']);
        } else if (styleLayer.type === 'fill') {
            styleLayerDistance = translateDistance(styleLayer.paint['fill-translate']);
        } else if (styleLayer.type === 'circle') {
            styleLayerDistance = styleLayer.paint['circle-radius'] + translateDistance(styleLayer.paint['circle-translate']);
        }
        additionalRadius = Math.max(additionalRadius, styleLayerDistance * pixelsToTileUnits);
    }

    var radiusSearch = typeof x !== 'undefined' && typeof y !== 'undefined';

    var radius, bounds, symbolQueryBox;
    if (radiusSearch) {
        // a point (or point+radius) query
        radius = (params.radius || 0) * pixelsToTileUnits;
        var searchRadius = radius + additionalRadius;
        bounds = [x - searchRadius, y - searchRadius, x + searchRadius, y + searchRadius];
        symbolQueryBox = new CollisionBox(new Point(x, y), -radius, -radius, radius, radius, args.scale, null);
    } else {
        // a rectangle query
        bounds = [ args.minX, args.minY, args.maxX, args.maxY ];
        symbolQueryBox = new CollisionBox(new Point(args.minX, args.minY), 0, 0, args.maxX - args.minX, args.maxY - args.minY, args.scale, null);
    }

    var matching = this.rtree.search(bounds).concat(this.collisionTile.getFeaturesAt(symbolQueryBox, args.scale));

    for (var k = 0; k < matching.length; k++) {
        var feature = matching[k].feature,
            layerIDs = matching[k].layerIDs,
            type = vt.VectorTileFeature.types[feature.type];

        if (params.$type && type !== params.$type)
            continue;

        var geoJSON = feature.toGeoJSON(this.x, this.y, this.z);

        if (!params.includeGeometry) {
            geoJSON.geometry = null;
        }

        for (var l = 0; l < layerIDs.length; l++) {
            var layerID = layerIDs[l];

            if (params.layerIds && params.layerIds.indexOf(layerID) < 0) {
                continue;
            }

            styleLayer = styleLayersByID[layerID];
            var geometry = loadGeometry(feature);

            var translatedPoint;
            if (styleLayer.type === 'symbol') {
                // all symbols already match the style

            } else if (styleLayer.type === 'line') {
                translatedPoint = translate(styleLayer.paint['line-translate'], styleLayer.paint['line-translate-anchor']);
                var halfWidth = styleLayer.paint['line-width'] / 2 * pixelsToTileUnits;
                if (styleLayer.paint['line-offset']) {
                    geometry = offsetLine(geometry, styleLayer.paint['line-offset'] * pixelsToTileUnits);
                }
                if (radiusSearch ?
                        !lineContainsPoint(geometry, translatedPoint, radius + halfWidth) :
                        !lineIntersectsBox(geometry, bounds)) {
                    continue;
                }

            } else if (styleLayer.type === 'fill') {
                translatedPoint = translate(styleLayer.paint['fill-translate'], styleLayer.paint['fill-translate-anchor']);
                if (radiusSearch ?
                        !(polyContainsPoint(geometry, translatedPoint) || lineContainsPoint(geometry, translatedPoint, radius)) :
                        !polyIntersectsBox(geometry, bounds)) {
                    continue;
                }

            } else if (styleLayer.type === 'circle') {
                translatedPoint = translate(styleLayer.paint['circle-translate'], styleLayer.paint['circle-translate-anchor']);
                var circleRadius = styleLayer.paint['circle-radius'] * pixelsToTileUnits;
                if (radiusSearch ?
                        !pointContainsPoint(geometry, translatedPoint, radius + circleRadius) :
                        !pointIntersectsBox(geometry, bounds)) {
                    continue;
                }
            }

            result.push(util.extend({layer: layerID}, geoJSON));
        }
    }

    function translate(translate, translateAnchor) {
        translate = Point.convert(translate);

        if (translateAnchor === "viewport") {
            translate._rotate(-args.bearing);
        }

        return p.sub(translate._mult(pixelsToTileUnits));
    }

    return result;
};

function offsetLine(rings, offset) {
    var newRings = [];
    var zero = new Point(0, 0);
    for (var k = 0; k < rings.length; k++) {
        var ring = rings[k];
        var newRing = [];
        for (var i = 0; i < ring.length; i++) {
            var a = ring[i - 1];
            var b = ring[i];
            var c = ring[i + 1];
            var aToB = i === 0 ? zero : b.sub(a)._unit()._perp();
            var bToC = i === ring.length - 1 ? zero : c.sub(b)._unit()._perp();
            var extrude = aToB._add(bToC)._unit();

            var cosHalfAngle = extrude.x * bToC.x + extrude.y * bToC.y;
            extrude._mult(1 / cosHalfAngle);

            newRing.push(extrude._mult(offset)._add(b));
        }
        newRings.push(newRing);
    }
    return newRings;
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
