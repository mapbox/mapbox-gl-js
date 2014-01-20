'use strict';

var Tile = require('./tile.js');
var Transform = require('./transform.js');
var Geometry = require('../geometry/geometry.js');
var util = require('../util/util.js');
var Bucket = require('../geometry/bucket.js');

module.exports = GeoJSONTile;

function GeoJSONTile(map, features, zoom) {
    this.map = map;
    this.features = features;

    this.geometry = new Geometry();

}

GeoJSONTile.prototype = Object.create(Tile.prototype);

GeoJSONTile.prototype.sortFeaturesIntoBuckets = function(features) {
    var mapping = this.map.style.stylesheet.buckets;

    var buckets = {};

    // todo unhardcode
    buckets.everything = [];

    for (var i = 0; i < this.features.length; i++) {
        var feature = this.features[i];
        for (var key in mapping) {
            // TODO
        }
        buckets.everything.push(feature);
    }

    return buckets;
};

GeoJSONTile.prototype._parse = function(features) {
    this.layers = {};

    var buckets = this.sortFeaturesIntoBuckets(this.features);

    for (var bucketname in buckets) {

        var bucket = new Bucket(this.map.style.stylesheet.buckets[bucketname], this.geometry);
        var bucketFeatures = buckets[bucketname];

        for (var i = 0; i < bucketFeatures.length; i++) {
            bucket.addFeature([bucketFeatures[i]]);
        }

        bucket.end();

        this.layers[bucketname] = bucket.indices;
    } 

};

GeoJSONTile.prototype._load = function() {
    if (this.loaded) return;
    this._parse(this.features);
    this.loaded = true;
};

// noops
GeoJSONTile.prototype.abort = function() { };
GeoJSONTile.prototype.remove = function() { };
