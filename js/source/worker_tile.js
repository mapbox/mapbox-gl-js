'use strict';

var FeatureTree = require('../data/feature_tree');
var CollisionTile = require('../symbol/collision_tile');
var Bucket = require('../data/bucket');

module.exports = WorkerTile;

function WorkerTile(params) {
    this.coord = params.coord;
    this.uid = params.uid;
    this.zoom = params.zoom;
    this.tileSize = params.tileSize;
    this.source = params.source;
    this.overscaling = params.overscaling;
    this.angle = params.angle;
    this.pitch = params.pitch;
    this.collisionDebug = params.collisionDebug;
}

WorkerTile.prototype.parse = function(data, layers, actor, callback) {

    this.status = 'parsing';

    this.featureTree = new FeatureTree(this.coord, this.overscaling);

    var stats = { _total: 0 };

    var tile = this;
    var bucketsById = {};
    var bucketsBySourceLayer = {};
    var i;
    var layer;
    var sourceLayerId;
    var bucket;

    // Map non-ref layers to buckets.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];

        if (layer.source !== this.source) continue;
        if (layer.ref) continue;
        if (layer.minzoom && this.zoom < layer.minzoom) continue;
        if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
        if (layer.layout && layer.layout.visibility === 'none') continue;

        bucket = Bucket.create({
            layer: layer,
            zoom: this.zoom,
            overscaling: this.overscaling,
            collisionDebug: this.collisionDebug
        });

        bucketsById[layer.id] = bucket;

        if (data.layers) { // vectortile
            sourceLayerId = layer['source-layer'];
            bucketsBySourceLayer[sourceLayerId] = bucketsBySourceLayer[sourceLayerId] || {};
            bucketsBySourceLayer[sourceLayerId][layer.id] = bucket;
        }
    }

    // Index ref layers.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];
        if (layer.source === this.source && layer.ref && bucketsById[layer.ref]) {
            bucketsById[layer.ref].layers.push(layer.id);
        }
    }

    // read each layer, and sort its features into buckets
    if (data.layers) { // vectortile
        for (sourceLayerId in bucketsBySourceLayer) {
            layer = data.layers[sourceLayerId];
            if (layer) {
                sortLayerIntoBuckets(layer, bucketsBySourceLayer[sourceLayerId]);
            }
        }
    } else { // geojson
        sortLayerIntoBuckets(data, bucketsById);
    }

    function sortLayerIntoBuckets(layer, buckets) {
        for (var i = 0; i < layer.length; i++) {
            var feature = layer.feature(i);
            for (var id in buckets) {
                if (buckets[id].filter(feature))
                    buckets[id].features.push(feature);
            }
        }
    }

    var buckets = [],
        symbolBuckets = this.symbolBuckets = [],
        otherBuckets = [];

    var collisionTile = new CollisionTile(this.angle, this.pitch);

    for (var id in bucketsById) {
        bucket = bucketsById[id];
        if (bucket.features.length === 0) continue;

        buckets.push(bucket);

        if (bucket.type === 'symbol')
            symbolBuckets.push(bucket);
        else
            otherBuckets.push(bucket);
    }

    var icons = {};
    var stacks = {};
    var deps = 0;


    if (symbolBuckets.length > 0) {

        // Get dependencies for symbol buckets
        for (i = symbolBuckets.length - 1; i >= 0; i--) {
            symbolBuckets[i].updateIcons(icons);
            symbolBuckets[i].updateFont(stacks);
        }

        for (var fontName in stacks) {
            stacks[fontName] = Object.keys(stacks[fontName]).map(Number);
        }
        icons = Object.keys(icons);

        actor.send('get glyphs', {uid: this.uid, stacks: stacks}, function(err, newStacks) {
            stacks = newStacks;
            gotDependency(err);
        });

        if (icons.length) {
            actor.send('get icons', {icons: icons}, function(err, newIcons) {
                icons = newIcons;
                gotDependency(err);
            });
        } else {
            gotDependency();
        }
    }

    // immediately parse non-symbol buckets (they have no dependencies)
    for (i = otherBuckets.length - 1; i >= 0; i--) {
        parseBucket(this, otherBuckets[i]);
    }

    if (symbolBuckets.length === 0)
        return done();

    function gotDependency(err) {
        if (err) return callback(err);
        deps++;
        if (deps === 2) {
            // all symbol bucket dependencies fetched; parse them in proper order
            for (var i = symbolBuckets.length - 1; i >= 0; i--) {
                parseBucket(tile, symbolBuckets[i]);
            }
            done();
        }
    }

    function parseBucket(tile, bucket) {
        var now = Date.now();
        bucket.addFeatures(collisionTile, stacks, icons);
        var time = Date.now() - now;

        if (bucket.interactive) {
            for (var i = 0; i < bucket.features.length; i++) {
                var feature = bucket.features[i];
                tile.featureTree.insert(feature.bbox(), bucket.layers, feature);
            }
        }

        bucket.features = null;

        stats._total += time;
        stats[bucket.id] = (stats[bucket.id] || 0) + time;
    }

    function done() {
        tile.status = 'done';

        if (tile.redoPlacementAfterDone) {
            tile.redoPlacement(tile.angle, tile.pitch, null);
            tile.redoPlacementAfterDone = false;
        }

        callback(null, {
            buckets: buckets.map(function(bucket) { return bucket.serialize(); }),
            bucketStats: stats // TODO put this in a separate message?
        }, getTransferables(buckets));
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, collisionDebug) {
    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    var collisionTile = new CollisionTile(angle, pitch);

    for (var i = this.symbolBuckets.length - 1; i >= 0; i--) {
        this.symbolBuckets[i].placeFeatures(collisionTile, collisionDebug);
    }

    return {
        result: {
            buckets: this.symbolBuckets.map(function(bucket) { return bucket.serialize(); })
        },
        transferables: getTransferables(this.symbolBuckets)
    };
};

function getTransferables(buckets) {
    var transferables = [];
    for (var i in buckets) {
        for (var j in buckets.buffers) {
            transferables.push(buckets[i].buffers[j].arrayBuffer);
        }
    }
    return transferables;
}
