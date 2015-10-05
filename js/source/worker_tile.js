'use strict';

var FeatureTree = require('../data/feature_tree');
var CollisionTile = require('../symbol/collision_tile');
var BufferSet = require('../data/buffer_set');
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

WorkerTile.prototype.parse = function(data, layers, actor, callback) {

    this.status = 'parsing';

    this.featureTree = new FeatureTree(this.coord, this.overscaling);

    var i, k,
        tile = this,
        layer,
        bucket,
        buffers = new BufferSet(),
        collisionTile = new CollisionTile(this.angle, this.pitch),
        buckets = {},
        symbolBuckets = this.symbolBuckets = [],
        otherBuckets = [],
        bucketsBySourceLayer = {};

    // Map non-ref layers to buckets.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];

        if (layer.source !== this.source)
            continue;

        if (layer.ref)
            continue;

        var minzoom = layer.minzoom;
        if (minzoom && this.zoom < minzoom)
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

        if (bucket.type === 'symbol')
            symbolBuckets.push(bucket);
        else
            otherBuckets.push(bucket);

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

    // immediately parse non-symbol buckets (they have no dependencies)
    for (i = otherBuckets.length - 1; i >= 0; i--) {
        parseBucket(tile, otherBuckets[i]);
    }

    var remaining = symbolBuckets.length;

    if (remaining === 0)
        done();

    // Get dependencies for symbol buckets
    for (i = symbolBuckets.length - 1; i >= 0; i--) {
        symbolBuckets[i].getDependencies(this, actor, symbolBucketDone);
    }

    function symbolBucketDone(err) {
        remaining--;
        if (err) console.error(err);

        if (remaining === 0) {
            // all symbol bucket dependencies fetched; parse them in proper order
            for (var i = symbolBuckets.length - 1; i >= 0; i--) {
                parseBucket(tile, symbolBuckets[i]);
            }
            done();
        }
    }

    function parseBucket(tile, bucket) {
        var now = Date.now();
        if (bucket.features.length) bucket.addFeatures(collisionTile);
        var time = Date.now() - now;

        if (bucket.interactive) {
            for (var i = 0; i < bucket.features.length; i++) {
                var feature = bucket.features[i];
                tile.featureTree.insert(feature.bbox(), bucket.layers, feature);
            }
        }

        bucket.features = null;

        if (typeof self !== 'undefined') {
            self.bucketStats = self.bucketStats || {_total: 0};
            self.bucketStats._total += time;
            self.bucketStats[bucket.id] = (self.bucketStats[bucket.id] || 0) + time;
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
            transferables.push(buffers[k].arrayBuffer);

            // The Buffer::push method is generated with "new Function(...)"
            // and not transferrable.
            delete buffers[k].push;
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

    var symbolBuckets = this.symbolBuckets;
    for (var i = symbolBuckets.length - 1; i >= 0; i--) {
        var bucket = symbolBuckets[i];

        bucket.placeFeatures(collisionTile, buffers, collisionDebug);
        elementGroups[bucket.id] = bucket.elementGroups;
    }

    for (var k in buffers) {
        transferables.push(buffers[k].arrayBuffer);

        // The Buffer::push method is generated with "new Function(...)"
        // and not transferrable.
        delete buffers[k].push;
    }

    return {
        result: {
            elementGroups: elementGroups,
            buffers: buffers
        },
        transferables: transferables
    };

};
