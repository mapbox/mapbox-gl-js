'use strict';

var rbush = require('rbush');
var Point = require('point-geometry');
var util = require('../util/util');
var loadGeometry = require('./load_geometry');
var EXTENT = require('./bucket').EXTENT;
var featureFilter = require('feature-filter');
var createStructArrayType = require('../util/struct_array');
var Grid = require('../util/grid');
var StringNumberMapping = require('../util/string_number_mapping');

var FeatureIndexArray = createStructArrayType([
        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' }
]);

module.exports = FeatureTree;

function FeatureTree(coord, overscaling, collisionTile, vtLayers) {
    this.x = coord.x;
    this.y = coord.y;
    this.z = coord.z - Math.log(overscaling) / Math.LN2;
    this.rtree = rbush(9);
    this.toBeInserted = [];
    this.grid = new Grid(16, EXTENT, 0);
    this.featureIndexArray = new FeatureIndexArray();
    this.setCollisionTile(collisionTile);
    this.vtLayers = vtLayers;
    this.sourceLayerNumberMapping = new StringNumberMapping(vtLayers ? Object.keys(vtLayers).sort() : []);
}

FeatureTree.prototype.insert = function(bbox, extent, featureIndex, sourceLayerIndex, bucketIndex) {
    var scale = EXTENT / extent;
    bbox[0] *= scale;
    bbox[1] *= scale;
    bbox[2] *= scale;
    bbox[3] *= scale;
    bbox.key = this.featureIndexArray.length;
    this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex);
    this.toBeInserted.push(bbox);
};

// bulk insert into tree
FeatureTree.prototype._load = function() {
    this.rtree.load(this.toBeInserted);
    for (var i = 0; i < this.toBeInserted.length; i++) {
        var bbox = this.toBeInserted[i];
        this.grid.insert(i, bbox[0], bbox[1], bbox[2], bbox[3]);
    }
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
    if (!this.vtLayers) return [];
    if (this.toBeInserted.length) this._load();

    var params = args.params || {},
        pixelsToTileUnits = EXTENT / args.tileSize / args.scale,
        filter = featureFilter(params.filter),
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

    var queryGeometry = args.queryGeometry.map(function(p) {
        return new Point(p.x, p.y);
    });

    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;
    for (var i = 0; i < queryGeometry.length; i++) {
        var p = queryGeometry[i];
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }

    var bounds = [minX - additionalRadius, minY - additionalRadius, maxX + additionalRadius, maxY + additionalRadius];
    var treeMatching = this.rtree.search(bounds);

    var matching = this.grid.query(minX - additionalRadius, minY - additionalRadius, maxX + additionalRadius, maxY + additionalRadius);
    var match = this.featureIndexArray.at(0);
    filterMatching.call(this, matching, match);

    if (matching.length !== treeMatching.length) throw Error("asdf");

    var matchingSymbols = this.collisionTile.queryRenderedSymbols(minX, minY, maxX, maxY, args.scale);
    var match2 = this.collisionTile.collisionBoxArray.at(0);
    filterMatching.call(this, matchingSymbols, match2);

    function filterMatching(matching, match) {
        for (var k = 0; k < matching.length; k++) {
            match._setIndex(matching[k]);
            var sourceLayerName = this.sourceLayerNumberMapping.numberToString[match.sourceLayerIndex];
            var sourceLayer = this.vtLayers[sourceLayerName];
            var feature = sourceLayer.feature(match.featureIndex);
            var layerIDs = this.numberToLayerIDs[match.bucketIndex];

            if (!filter(feature)) continue;

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

                var translatedPolygon;
                if (styleLayer.type === 'symbol') {
                    // all symbols already match the style

                } else if (styleLayer.type === 'line') {
                    translatedPolygon = translate(styleLayer.paint['line-translate'], styleLayer.paint['line-translate-anchor']);
                    var halfWidth = styleLayer.paint['line-width'] / 2 * pixelsToTileUnits;
                    if (styleLayer.paint['line-offset']) {
                        geometry = offsetLine(geometry, styleLayer.paint['line-offset'] * pixelsToTileUnits);
                    }
                    if (!polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth)) continue;

                } else if (styleLayer.type === 'fill') {
                    translatedPolygon = translate(styleLayer.paint['fill-translate'], styleLayer.paint['fill-translate-anchor']);
                    if (!polygonIntersectsMultiPolygon(translatedPolygon, geometry)) continue;

                } else if (styleLayer.type === 'circle') {
                    translatedPolygon = translate(styleLayer.paint['circle-translate'], styleLayer.paint['circle-translate-anchor']);
                    var circleRadius = styleLayer.paint['circle-radius'] * pixelsToTileUnits;
                    if (!polygonIntersectsBufferedMultiPoint(translatedPolygon, geometry, circleRadius)) continue;
                }

                result.push(util.extend({layer: layerID}, geoJSON));
            }
        }
    }

    function translate(translate, translateAnchor) {
        if (!translate[0] && !translate[1]) {
            return queryGeometry;
        }

        translate = Point.convert(translate);

        if (translateAnchor === "viewport") {
            translate._rotate(-args.bearing);
        }

        var translated = [];
        for (var i = 0; i < queryGeometry.length; i++) {
            translated.push(queryGeometry[i].sub(translate._mult(pixelsToTileUnits)));
        }
        return translated;
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

function polygonIntersectsBufferedMultiPoint(polygon, rings, radius) {
    var multiPolygon = [polygon];
    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var k = 0; k < ring.length; k++) {
            var point = ring[k];
            if (multiPolygonContainsPoint(multiPolygon, point)) return true;
            if (pointIntersectsBufferedLine(point, polygon, radius)) return true;
        }
    }
    return false;
}

function polygonIntersectsMultiPolygon(polygon, multiPolygon) {
    for (var i = 0; i < polygon.length; i++) {
        if (multiPolygonContainsPoint(multiPolygon, polygon[i])) return true;
    }

    var polygon_ = [polygon];
    for (var m = 0; m < multiPolygon.length; m++) {
        var ring = multiPolygon[m];
        for (var n = 0; n < ring.length; n++) {
            if (multiPolygonContainsPoint(polygon_, ring[n])) return true;
        }
    }

    for (var k = 0; k < multiPolygon.length; k++) {
        if (lineIntersectsLine(polygon, multiPolygon[k])) return true;
    }
    return false;
}

function polygonIntersectsBufferedMultiLine(polygon, multiLine, radius) {
    var multiPolygon = [polygon];
    for (var i = 0; i < multiLine.length; i++) {
        var line = multiLine[i];

        for (var k = 0; k < line.length; k++) {
            if (multiPolygonContainsPoint(multiPolygon, line[k])) return true;
        }

        if (lineIntersectsBufferedLine(polygon, line, radius)) return true;
    }
    return false;
}

function lineIntersectsBufferedLine(lineA, lineB, radius) {

    if (lineIntersectsLine(lineA, lineB)) return true;

    // Check whether any point in either line is within radius of the other line
    for (var j = 0; j < lineB.length; j++) {
        if (pointIntersectsBufferedLine(lineB[j], lineA, radius)) return true;
    }

    for (var k = 0; k < lineA.length; k++) {
        if (pointIntersectsBufferedLine(lineA[k], lineB, radius)) return true;
    }

    return false;
}

function lineIntersectsLine(lineA, lineB) {
    for (var i = 0; i < lineA.length - 1; i++) {
        var a0 = lineA[i];
        var a1 = lineA[i + 1];
        for (var j = 0; j < lineB.length - 1; j++) {
            var b0 = lineB[j];
            var b1 = lineB[j + 1];
            if (lineSegmentIntersectsLineSegment(a0, a1, b0, b1)) return true;
        }
    }
    return false;
}


// http://bryceboe.com/2006/10/23/line-segment-intersection-algorithm/
function isCounterClockwise(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

function lineSegmentIntersectsLineSegment(a0, a1, b0, b1) {
    return isCounterClockwise(a0, b0, b1) !== isCounterClockwise(a1, b0, b1) &&
        isCounterClockwise(a0, a1, b0) !== isCounterClockwise(a0, a1, b1);
}

function pointIntersectsBufferedLine(p, line, radius) {
    var radiusSquared = radius * radius;

    if (line.length === 1) return p.distSqr(line[0]) < radiusSquared;

    for (var i = 1; i < line.length; i++) {
        // Find line segments that have a distance <= radius^2 to p
        // In that case, we treat the line as "containing point p".
        var v = line[i - 1], w = line[i];
        if (distToSegmentSquared(p, v, w) < radiusSquared) return true;
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

// point in polygon ray casting algorithm
function multiPolygonContainsPoint(rings, p) {
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
