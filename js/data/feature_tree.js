'use strict';

var Point = require('point-geometry');
var loadGeometry = require('./load_geometry');
var EXTENT = require('./bucket').EXTENT;
var featureFilter = require('feature-filter');
var createStructArrayType = require('../util/struct_array');
var Grid = require('../util/grid');
var StringNumberMapping = require('../util/string_number_mapping');
var vt = require('vector-tile');
var Protobuf = require('pbf');
var GeoJSONFeature = require('../util/vectortile_to_geojson');

var FeatureIndexArray = createStructArrayType([
        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' }
]);

var FilteredFeatureIndexArray = createStructArrayType([
        // the index of the feature in the original vectortile
        { type: 'Uint32', name: 'featureIndex' },
        // the source layer the feature appears in
        { type: 'Uint16', name: 'sourceLayerIndex' },
        // the bucket the feature appears in
        { type: 'Uint16', name: 'bucketIndex' },
        // the layer the feature appears in
        { type: 'Uint16', name: 'layerIndex' }
]);

module.exports = FeatureTree;

function FeatureTree(coord, overscaling, collisionTile) {
    if (coord.grid) {
        var serialized = coord;
        var rawTileData = overscaling;
        coord = serialized.coord;
        overscaling = serialized.overscaling;
        this.grid = new Grid(serialized.grid);
        this.featureIndexArray = new FeatureIndexArray(serialized.featureIndexArray);
        this.rawTileData = rawTileData;
        this.numberToLayerIDs = serialized.numberToLayerIDs;
    } else {
        this.grid = new Grid(16, EXTENT, 0);
        this.featureIndexArray = new FeatureIndexArray();
    }
    this.coord = coord;
    this.overscaling = overscaling;
    this.x = coord.x;
    this.y = coord.y;
    this.z = coord.z - Math.log(overscaling) / Math.LN2;
    this.setCollisionTile(collisionTile);
}

FeatureTree.prototype.insert = function(feature, featureIndex, sourceLayerIndex, bucketIndex) {
    var key = this.featureIndexArray.length;
    this.featureIndexArray.emplaceBack(featureIndex, sourceLayerIndex, bucketIndex);
    var geometry = loadGeometry(feature);

    for (var r = 0; r < geometry.length; r++) {
        var ring = geometry[r];

        // TODO: skip holes when we start using vector tile spec 2.0

        var bbox = [Infinity, Infinity, -Infinity, -Infinity];
        for (var i = 0; i < ring.length; i++) {
            var p = ring[i];
            bbox[0] = Math.min(bbox[0], p.x);
            bbox[1] = Math.min(bbox[1], p.y);
            bbox[2] = Math.max(bbox[2], p.x);
            bbox[3] = Math.max(bbox[3], p.y);
        }

        this.grid.insert(key, bbox[0], bbox[1], bbox[2], bbox[3]);
    }
};

FeatureTree.prototype.setCollisionTile = function(collisionTile) {
    this.collisionTile = collisionTile;
};

FeatureTree.prototype.serialize = function() {
    var data = {
        coord: this.coord,
        overscaling: this.overscaling,
        grid: this.grid.toArrayBuffer(),
        featureIndexArray: this.featureIndexArray.arrayBuffer,
        numberToLayerIDs: this.numberToLayerIDs
    };
    return {
        data: data,
        transferables: [data.grid, data.featureIndexArray]
    };
};

function translateDistance(translate) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}

// Finds features in this tile at a particular position.
FeatureTree.prototype.query = function(result, args, styleLayersByID, returnGeoJSON) {
    if (!this.vtLayers) {
        if (!this.rawTileData) return [];
        this.vtLayers = new vt.VectorTile(new Protobuf(new Uint8Array(this.rawTileData))).layers;
        this.sourceLayerNumberMapping = new StringNumberMapping(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
    }

    if (!returnGeoJSON) {
        result = new FilteredFeatureIndexArray();
    }

    var params = args.params || {},
        pixelsToTileUnits = EXTENT / args.tileSize / args.scale,
        filter = featureFilter(params.filter);

    // Features are indexed their original geometries. The rendered geometries may
    // be buffered, translated or offset. Figure out how much the search radius needs to be
    // expanded by to include these features.
    var additionalRadius = 0;
    for (var id in styleLayersByID) {
        var styleLayer = styleLayersByID[id];

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

    var matching = this.grid.query(minX - additionalRadius, minY - additionalRadius, maxX + additionalRadius, maxY + additionalRadius);
    var match = this.featureIndexArray.at(0);
    this.filterMatching(result, matching, match, queryGeometry, filter, params.layerIds, styleLayersByID, args.bearing, pixelsToTileUnits, returnGeoJSON);

    var matchingSymbols = this.collisionTile.queryRenderedSymbols(minX, minY, maxX, maxY, args.scale);
    var match2 = this.collisionTile.collisionBoxArray.at(0);
    this.filterMatching(result, matchingSymbols, match2, queryGeometry, filter, params.layerIds, styleLayersByID, args.bearing, pixelsToTileUnits, returnGeoJSON);

    if (!returnGeoJSON) {
        result = result.arrayBuffer;
    }

    return result;
};

FeatureTree.prototype.filterMatching = function(result, matching, match, queryGeometry, filter, filterLayerIDs, styleLayersByID, bearing, pixelsToTileUnits, returnGeoJSON) {
    var seen = {};
    for (var k = 0; k < matching.length; k++) {
        var index = matching[k];

        if (seen[index]) continue;
        seen[index] = true;

        match._setIndex(index);

        var layerIDs = this.numberToLayerIDs[match.bucketIndex];
        if (filterLayerIDs && !matchLayers(filterLayerIDs, layerIDs)) continue;

        var sourceLayerName = this.sourceLayerNumberMapping.numberToString[match.sourceLayerIndex];
        var sourceLayer = this.vtLayers[sourceLayerName];
        var feature = sourceLayer.feature(match.featureIndex);

        if (!filter(feature)) continue;

        var geometry = null;

        for (var l = 0; l < layerIDs.length; l++) {
            var layerID = layerIDs[l];

            if (filterLayerIDs && filterLayerIDs.indexOf(layerID) < 0) {
                continue;
            }

            var styleLayer = styleLayersByID[layerID];

            var translatedPolygon;
            if (styleLayer.type !== 'symbol') {
                // all symbols already match the style

                if (!geometry) geometry = loadGeometry(feature);

                if (styleLayer.type === 'line') {
                    translatedPolygon = translate(queryGeometry,
                            styleLayer.paint['line-translate'], styleLayer.paint['line-translate-anchor'],
                            bearing, pixelsToTileUnits);
                    var halfWidth = styleLayer.paint['line-width'] / 2 * pixelsToTileUnits;
                    if (styleLayer.paint['line-offset']) {
                        geometry = offsetLine(geometry, styleLayer.paint['line-offset'] * pixelsToTileUnits);
                    }
                    if (!polygonIntersectsBufferedMultiLine(translatedPolygon, geometry, halfWidth)) continue;

                } else if (styleLayer.type === 'fill') {
                    translatedPolygon = translate(queryGeometry,
                            styleLayer.paint['fill-translate'], styleLayer.paint['fill-translate-anchor'],
                            bearing, pixelsToTileUnits);
                    if (!polygonIntersectsMultiPolygon(translatedPolygon, geometry)) continue;

                } else if (styleLayer.type === 'circle') {
                    translatedPolygon = translate(queryGeometry,
                            styleLayer.paint['circle-translate'], styleLayer.paint['circle-translate-anchor'],
                            bearing, pixelsToTileUnits);
                    var circleRadius = styleLayer.paint['circle-radius'] * pixelsToTileUnits;
                    if (!polygonIntersectsBufferedMultiPoint(translatedPolygon, geometry, circleRadius)) continue;
                }
            }

            if (returnGeoJSON) {
                var geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y);
                geojsonFeature.layer = layerID;
                result.push(geojsonFeature);
            } else {
                result.emplaceBack(match.featureIndex, match.sourceLayerIndex, match.bucketIndex, l);
            }
        }
    }
};

FeatureTree.prototype.makeGeoJSON = function(result, featureIndexArray) {
    if (!this.vtLayers) {
        if (!this.rawTileData) return [];
        this.vtLayers = new vt.VectorTile(new Protobuf(new Uint8Array(this.rawTileData))).layers;
        this.sourceLayerNumberMapping = new StringNumberMapping(this.vtLayers ? Object.keys(this.vtLayers).sort() : ['_geojsonTileLayer']);
    }

    featureIndexArray = new FilteredFeatureIndexArray(featureIndexArray);
    var indexes = featureIndexArray.at(0);

    var cachedLayerFeatures = {};
    for (var i = 0; i < featureIndexArray.length; i++) {
        indexes._setIndex(i);
        var sourceLayerName = this.sourceLayerNumberMapping.numberToString[indexes.sourceLayerIndex];
        var sourceLayer = this.vtLayers[sourceLayerName];
        var featureIndex = indexes.featureIndex;

        var cachedFeatures = cachedLayerFeatures[sourceLayerName];
        if (cachedFeatures === undefined) {
            cachedFeatures = cachedLayerFeatures[sourceLayerName] = {};
        }

        var feature = cachedFeatures[featureIndex] = cachedFeatures[featureIndex] || sourceLayer.feature(featureIndex);
        var geojsonFeature = new GeoJSONFeature(feature, this.z, this.x, this.y);
        geojsonFeature.layer = this.numberToLayerIDs[indexes.bucketIndex][indexes.layerIndex];
        result.push(geojsonFeature);
    }
};

function translate(queryGeometry, translate, translateAnchor, bearing, pixelsToTileUnits) {
    if (!translate[0] && !translate[1]) {
        return queryGeometry;
    }

    translate = Point.convert(translate);

    if (translateAnchor === "viewport") {
        translate._rotate(-bearing);
    }

    var translated = [];
    for (var i = 0; i < queryGeometry.length; i++) {
        translated.push(queryGeometry[i].sub(translate._mult(pixelsToTileUnits)));
    }
    return translated;
}

function matchLayers(filterLayerIDs, featureLayerIDs) {
    for (var l = 0; l < featureLayerIDs.length; l++) {
        if (filterLayerIDs.indexOf(featureLayerIDs[l]) >= 0) return true;
    }
    return false;
}

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
    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (var k = 0; k < ring.length; k++) {
            var point = ring[k];
            if (polygonContainsPoint(polygon, point)) return true;
            if (pointIntersectsBufferedLine(point, polygon, radius)) return true;
        }
    }
    return false;
}

function polygonIntersectsMultiPolygon(polygon, multiPolygon) {

    if (polygon.length === 1) {
        return multiPolygonContainsPoint(multiPolygon, polygon[0]);
    }

    for (var m = 0; m < multiPolygon.length; m++) {
        var ring = multiPolygon[m];
        for (var n = 0; n < ring.length; n++) {
            if (polygonContainsPoint(polygon, ring[n])) return true;
        }
    }

    for (var i = 0; i < polygon.length; i++) {
        if (multiPolygonContainsPoint(multiPolygon, polygon[i])) return true;
    }

    for (var k = 0; k < multiPolygon.length; k++) {
        if (lineIntersectsLine(polygon, multiPolygon[k])) return true;
    }
    return false;
}

function polygonIntersectsBufferedMultiLine(polygon, multiLine, radius) {
    for (var i = 0; i < multiLine.length; i++) {
        var line = multiLine[i];

        for (var k = 0; k < line.length; k++) {
            if (polygonContainsPoint(polygon, line[k])) return true;
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

function polygonContainsPoint(ring, p) {
    var c = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var p1 = ring[i];
        var p2 = ring[j];
        if (((p1.y > p.y) !== (p2.y > p.y)) && (p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
            c = !c;
        }
    }
    return c;
}
