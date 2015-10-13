'use strict';

var FeatureTree = require('../data/feature_tree');
var CollisionTile = require('../symbol/collision_tile');
var BufferSet = require('../data/buffer_set');
var Bucket = require('../data/buffer_builder/buffer_builder');

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

    var tile = this,
        buffers = new BufferSet(),
        collisionTile = new CollisionTile(this.angle, this.pitch),
        bucketsById = {},
        bucketsBySourceLayer = {},
        i, layer, sourceLayerId, bucket;

    // Map non-ref layers to buckets.
    for (i = 0; i < layers.length; i++) {
        layer = layers[i];

        if (layer.source !== this.source ||
                layer.ref ||
                layer.minzoom && this.zoom < layer.minzoom ||
                layer.maxzoom && this.zoom >= layer.maxzoom ||
                layer.layout.visibility === 'none')
            continue;

        bucket = new Bucket(buffers, {
            layer: layer,
            zoom: this.zoom,
            overscaling: this.overscaling,
            collisionDebug: this.collisionDebug
        });
        bucket.layers = [layer.id];

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

    var extent = 4096;

    // read each layer, and sort its features into buckets
    if (data.layers) { // vectortile
        for (sourceLayerId in bucketsBySourceLayer) {
            layer = data.layers[sourceLayerId];
            if (!layer) continue;
            if (layer.extent) extent = layer.extent;
            sortLayerIntoBuckets(layer, bucketsBySourceLayer[sourceLayerId]);
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

    for (var id in bucketsById) {
        bucket = bucketsById[id];
        if (bucket.features.length === 0) continue;

        buckets.push(bucket);

        if (bucket.type === 'symbol')
            symbolBuckets.push(bucket);
        else
            otherBuckets.push(bucket);
    }

    var icons = {},
        stacks = {};

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

        var deps = 0;

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
            tile.redoPlacementAfterDone = false;
        }

        callback(null, {
            elementGroups: getElementGroups(buckets),
            buffers: buffers,
            extent: extent,
            bucketStats: typeof self !== 'undefined' ? self.bucketStats : null
        }, getTransferables(buffers));
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, collisionDebug) {

    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    var buffers = new BufferSet(),
        collisionTile = new CollisionTile(angle, pitch);

    for (var i = this.symbolBuckets.length - 1; i >= 0; i--) {
        this.symbolBuckets[i].placeFeatures(collisionTile, buffers, collisionDebug);
    }

    return {
        result: {
            elementGroups: getElementGroups(this.symbolBuckets),
            buffers: buffers
        },
        transferables: getTransferables(buffers)
    };
};

function getElementGroups(buckets) {
    var elementGroups = {};

    for (var i = 0; i < buckets.length; i++) {
        elementGroups[buckets[i].id] = buckets[i].elementGroups;
    }
    return elementGroups;
}

function getTransferables(buffers) {
    var transferables = [];

    for (var k in buffers) {
        transferables.push(buffers[k].arrayBuffer);

        // The Buffer::push method is generated with "new Function(...)" and not transferrable.
        buffers[k].push = null;
    }
    return transferables;
}
