'use strict';

var Point = require('point-geometry');
var VectorTileFeature = require('vector-tile').VectorTileFeature;
var EXTENT = require('../data/bucket').EXTENT;

module.exports = GeoJSONWrapper;

// conform to vectortile api
function GeoJSONWrapper(features) {
    this.features = features;
    this.length = features.length;
    this.extent = EXTENT;
}

GeoJSONWrapper.prototype.feature = function(i) {
    return new FeatureWrapper(this.features[i]);
};

function FeatureWrapper(feature) {
    this.type = feature.type;
    if (feature.type === 1) {
        this.rawGeometry = [];
        for (var i = 0; i < feature.geometry.length; i++) {
            this.rawGeometry.push([feature.geometry[i]]);
        }
    } else {
        this.rawGeometry = feature.geometry;
    }
    this.properties = feature.tags;
    this.extent = EXTENT;
}

FeatureWrapper.prototype.loadGeometry = function() {
    var rings = this.rawGeometry;
    this.geometry = [];

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i],
            newRing = [];
        for (var j = 0; j < ring.length; j++) {
            newRing.push(new Point(ring[j][0], ring[j][1]));
        }
        this.geometry.push(newRing);
    }
    return this.geometry;
};

FeatureWrapper.prototype.bbox = function() {
    if (!this.geometry) this.loadGeometry();

    var rings = this.geometry,
        x1 = Infinity,
        x2 = -Infinity,
        y1 = Infinity,
        y2 = -Infinity;

    for (var i = 0; i < rings.length; i++) {
        var ring = rings[i];

        for (var j = 0; j < ring.length; j++) {
            var coord = ring[j];

            x1 = Math.min(x1, coord.x);
            x2 = Math.max(x2, coord.x);
            y1 = Math.min(y1, coord.y);
            y2 = Math.max(y2, coord.y);
        }
    }

    return [x1, y1, x2, y2];
};

FeatureWrapper.prototype.toGeoJSON = VectorTileFeature.prototype.toGeoJSON;
