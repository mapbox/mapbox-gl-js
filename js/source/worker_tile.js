'use strict';

var FeatureTree = require('../data/feature_tree');
var Collision = require('../symbol/collision');
var BufferSet = require('../data/buffer/buffer_set');
var createBucket = require('../data/create_bucket');

module.exports = WorkerTile;

function WorkerTile(params) {
    this.id = params.id;
    this.uid = params.uid;
    this.zoom = params.zoom;
    this.maxZoom = params.maxZoom;
    this.tileSize = params.tileSize;
    this.source = params.source;
    this.overscaling = params.overscaling;
}

WorkerTile.prototype.parse = function(data, layers, actor, callback) {
    this.featureTree = new FeatureTree(this.id);

    var i, k,
        tile = this,
        layer,
        bucket,
        buffers = new BufferSet(),
        collision = new Collision(this.zoom, 4096, this.tileSize),
        buckets = {},
        bucketsInOrder = [],
        bucketsBySourceLayer = {};

    // Map non-ref layers to buckets.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];

        if (layer.source !== this.source)
            continue;

        if (layer.ref)
            continue;

        var minzoom = layer.minzoom;
        if (minzoom && this.zoom < minzoom && minzoom < this.maxZoom)
            continue;

        var maxzoom = layer.maxzoom;
        if (maxzoom && this.zoom >= maxzoom)
            continue;

        var visibility = layer.layout.visibility;
        if (visibility === 'none')
            continue;

        bucket = createBucket(layer, buffers, collision, this.zoom, this.overscaling);
        bucket.layers = [layer.id];

        buckets[bucket.id] = bucket;
        bucketsInOrder.push(bucket);

        if (data.layers) {
            // vectortile
            var sourceLayer = layer['source-layer'];
            if (!bucketsBySourceLayer[sourceLayer])
                bucketsBySourceLayer[sourceLayer] = {};
            bucketsBySourceLayer[sourceLayer][bucket.id] = bucket;
        } else {
            // geojson tile
            bucketsBySourceLayer[bucket.id] = bucket;
        }
    }

    // Index ref layers.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];

        if (layer.source !== this.source)
            continue;

        if (!layer.ref)
            continue;

        bucket = buckets[layer.ref];
        if (!bucket)
            continue;

        bucket.layers.push(layer.id);
    }

    // read each layer, and sort its features into buckets
    if (data.layers) {
        // vectortile
        for (k in bucketsBySourceLayer) {
            layer = data.layers[k];
            if (!layer) continue;
            sortLayerIntoBuckets(layer, bucketsBySourceLayer[k]);
        }
    } else {
        // geojson
        sortLayerIntoBuckets(data, bucketsBySourceLayer);
    }

    function sortLayerIntoBuckets(layer, buckets) {
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            for (var key in buckets) {
                var bucket = buckets[key];
                if (bucket.filter(feature)) {
                    bucket.features.push(feature);
                }
            }
        }
    }

    var prevPlacementBucket;
    var remaining = bucketsInOrder.length;

    /*
     *  The async parsing here is a bit tricky.
     *  Some buckets depend on resources that may need to be loaded async (glyphs).
     *  Some buckets need to be parsed in order (to get placement priorities right).
     *
     *  Dependencies calls are initiated first to get those rolling.
     *  Buckets that don't need to be parsed in order, aren't to save time.
     */

    for (i = 0; i < bucketsInOrder.length; i++) {
        bucket = bucketsInOrder[i];

        // Link buckets that need to be parsed in order
        if (bucket.collision) {
            if (prevPlacementBucket) {
                prevPlacementBucket.next = bucket;
            } else {
                bucket.previousPlaced = true;
            }
            prevPlacementBucket = bucket;
        }

        if (bucket.getDependencies) {
            bucket.getDependencies(this, actor, dependenciesDone(bucket));
        }

        // immediately parse buckets where order doesn't matter and no dependencies
        if (!bucket.collision && !bucket.getDependencies) {
            parseBucket(tile, bucket);
        }
    }

    function dependenciesDone(bucket) {
        return function(err) {
            bucket.dependenciesLoaded = true;
            parseBucket(tile, bucket, err);
        };
    }

    function parseBucket(tile, bucket, skip) {
        if (bucket.getDependencies && !bucket.dependenciesLoaded) return;
        if (bucket.collision && !bucket.previousPlaced) return;

        if (!skip) {
            var now = Date.now();
            if (bucket.features.length) bucket.addFeatures();
            var time = Date.now() - now;
            if (bucket.interactive) {
                for (var i = 0; i < bucket.features.length; i++) {
                    var feature = bucket.features[i];
                    tile.featureTree.insert(feature.bbox(), bucket.layers, feature);
                }
            }
            if (typeof self !== 'undefined') {
                self.bucketStats = self.bucketStats || {_total: 0};
                self.bucketStats._total += time;
                self.bucketStats[bucket.id] = (self.bucketStats[bucket.id] || 0) + time;
            }
        }

        remaining--;

        if (!remaining) {
            done();
            return;
        }

        // try parsing the next bucket, if it is ready
        if (bucket.next) {
            bucket.next.previousPlaced = true;
            parseBucket(tile, bucket.next);
        }
    }

    function done() {
        var transferables = [],
            elementGroups = {};

        for (k in buffers) {
            transferables.push(buffers[k].array);
        }

        for (k in buckets) {
            elementGroups[k] = buckets[k].elementGroups;
        }

        callback(null, {
            elementGroups: elementGroups,
            buffers: buffers
        }, transferables);
    }
};
