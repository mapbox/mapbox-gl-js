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

    for (var name in mapping) {
        if (mapping[name].datasource === 'geojson') {
            buckets[name] = new Bucket(mapping[name], this.geometry);
            buckets[name].features = [];
        }
    }

    for (var i = 0; i < this.features.length; i++) {
        var feature = this.features[i];
        for (var key in buckets) {

            if (!buckets[key].compare || buckets[key].compare(feature.properties)) {

                var type = mapping[key].feature_type || mapping[key].type;
                if (type === feature.type) {
                    buckets[key].features.push(feature);
                }
            }
        }
    }

    return buckets;
};

GeoJSONTile.prototype._parse = function(features) {
    this.layers = {};

    var buckets = this.sortFeaturesIntoBuckets(this.features);

    for (var name in buckets) {

        var bucket = buckets[name];
        if (!bucket.features.length) continue;

        bucket.start();

        for (var i = 0; i < bucket.features.length; i++) {
            console.log(bucket.info, bucket.features[i]);
            bucket.addFeature(bucket.features[i].coords);
        }

        bucket.end();

        this.layers[name] = bucket.indices;
    } 

    console.log(this.layers);

};

GeoJSONTile.prototype._load = function() {
    if (this.loaded) return;
    this._parse(this.features);
    this.loaded = true;
};

// noops
GeoJSONTile.prototype.abort = function() { };
GeoJSONTile.prototype.remove = function() { };
