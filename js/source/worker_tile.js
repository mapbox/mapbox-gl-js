'use strict';

var FeatureTree = require('../data/feature_tree');
var CollisionTile = require('../symbol/collision_tile');
var BufferSet = require('../data/buffer/buffer_set');
var createBucket = require('../data/create_bucket');

module.exports = WorkerTile;

function WorkerTile(params) {
    this.coord = params.coord;
    this.uid = params.uid;
    this.zoom = params.zoom;
    this.maxZoom = params.maxZoom;
    this.tileSize = params.tileSize;
    this.source = params.source;
    this.overscaling = params.overscaling;
    this.angle = params.angle;
    this.pitch = params.pitch;
    this.collisionDebug = params.collisionDebug;

    this.stacks = {};
}

WorkerTile.prototype.parse = function(data, layers, actor, callback, dz, xPos, yPos) {

    this.status = 'parsing';

    this.featureTree = new FeatureTree(this.coord, this.overscaling);

    var i, k,
        tile = this,
        layer,
        bucket,
        buffers = new BufferSet(),
        collisionTile = new CollisionTile(this.angle, this.pitch),
        buckets = {},
        bucketsInOrder = this.bucketsInOrder = [],
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

        bucket = createBucket(layer, buffers, this.zoom, this.overscaling, this.collisionDebug);
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

    var extent = 4096;

    // read each layer, and sort its features into buckets
    if (data.layers) {
        // vectortile
        for (k in bucketsBySourceLayer) {
            layer = data.layers[k];
            if (!layer) continue;
            if (layer.extent) extent = layer.extent;
            sortLayerIntoBuckets(layer, bucketsBySourceLayer[k], dz, xPos, yPos);
        }
    } else {
        // geojson
        sortLayerIntoBuckets(data, bucketsBySourceLayer);
    }

    function sortLayerIntoBuckets(layer, buckets, dz, xPos, yPos) {
        for (var i = 0; i < layer.length; i++) {
          var feature = layer.feature(i);

            // propagate clipped position in tile at the feature level
            feature.dz = dz;
            feature.xPos = xPos;
            feature.yPos = yPos;

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
     *  Some buckets need to be parsed in order (to get collision priorities right).
     *
     *  Dependencies calls are initiated first to get those rolling.
     *  Buckets that don't need to be parsed in order, aren't to save time.
     */

    for (i = bucketsInOrder.length - 1; i >= 0; i--) {
        bucket = bucketsInOrder[i];

        // Link buckets that need to be parsed in order
        if (bucket.needsPlacement) {
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
        if (!bucket.needsPlacement && !bucket.getDependencies) {
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
        if (bucket.needsPlacement && !bucket.previousPlaced) return;

        if (!skip) {
            var now = Date.now();
            if (bucket.features.length) bucket.addFeatures(collisionTile);
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
            bucket.features = null;
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

        tile.status = 'done';

        if (tile.redoPlacementAfterDone) {
            var result = tile.redoPlacement(tile.angle, tile.pitch).result;
            buffers.glyphVertex = result.buffers.glyphVertex;
            buffers.iconVertex = result.buffers.iconVertex;
            buffers.collisionBoxVertex = result.buffers.collisionBoxVertex;
        }

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
            buffers: buffers,
            extent: extent,
            bucketStats: typeof self !== 'undefined' ? self.bucketStats : null
        }, transferables);
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, collisionDebug) {

    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    var buffers = new BufferSet();
    var transferables = [];
    var elementGroups = {};
    var collisionTile = new CollisionTile(angle, pitch);

    var bucketsInOrder = this.bucketsInOrder;
    for (var i = bucketsInOrder.length - 1; i >= 0; i--) {
        var bucket = bucketsInOrder[i];

        if (bucket.type === 'symbol') {
            bucket.placeFeatures(collisionTile, buffers, collisionDebug);
            elementGroups[bucket.id] = bucket.elementGroups;
        }
    }

    for (var k in buffers) {
        transferables.push(buffers[k].array);
    }

    return {
        result: {
            elementGroups: elementGroups,
            buffers: buffers
        },
        transferables: transferables
    };

};
