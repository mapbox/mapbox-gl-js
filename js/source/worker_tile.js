'use strict';

var FeatureTree = require('../data/feature_tree');
var CollisionTile = require('../symbol/collision_tile');
var Bucket = require('../data/bucket');
var featureFilter = require('feature-filter');
var CollisionBoxArray = require('../symbol/collision_box');
var StringNumberMapping = require('../util/string_number_mapping');

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
    this.showCollisionBoxes = params.showCollisionBoxes;
}

WorkerTile.prototype.parse = function(data, layers, actor, callback, rawTileData) {

    this.status = 'parsing';
    this.data = data;

    this.collisionBoxArray = new CollisionBoxArray();
    var collisionTile = new CollisionTile(this.angle, this.pitch, this.collisionBoxArray);
    this.featureTree = new FeatureTree(this.coord, this.overscaling, collisionTile, data.layers);
    var sourceLayerNumberMapping = new StringNumberMapping(data.layers ? Object.keys(data.layers).sort() : []);

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
            showCollisionBoxes: this.showCollisionBoxes,
            collisionBoxArray: this.collisionBoxArray,
            sourceLayerIndex: sourceLayerNumberMapping.stringToNumber[layer['source-layer']]
        });
        bucket.createFilter();

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
            bucketsById[layer.ref].layerIDs.push(layer.id);
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
            feature.index = i;
            for (var id in buckets) {
                if (buckets[id].filter(feature))
                    buckets[id].features.push(feature);
            }
        }
    }

    var buckets = [],
        symbolBuckets = this.symbolBuckets = [],
        otherBuckets = [];

    this.featureTree.numberToLayerIDs = [];

    for (var id in bucketsById) {
        bucket = bucketsById[id];
        if (bucket.features.length === 0) continue;

        bucket.index = this.featureTree.numberToLayerIDs.length;
        this.featureTree.numberToLayerIDs.push(bucket.layerIDs);

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
        bucket.populateBuffers(collisionTile, stacks, icons);
        var time = Date.now() - now;


        if (bucket.type !== 'symbol') {
            for (var i = 0; i < bucket.features.length; i++) {
                var feature = bucket.features[i];
                tile.featureTree.insert(feature, feature.index, bucket.sourceLayerIndex, bucket.index);
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

        var featureTree = tile.featureTree.serialize();

        callback(null, {
            buckets: buckets.filter(isBucketEmpty).map(serializeBucket),
            bucketStats: stats, // TODO put this in a separate message?
            featureTree: featureTree.data,
            rawTileData: rawTileData
        }, getTransferables(buckets).concat(featureTree.transferables.concat(rawTileData)));
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, showCollisionBoxes) {
    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    var collisionTile = new CollisionTile(angle, pitch, this.collisionBoxArray);

    this.featureTree.setCollisionTile(collisionTile);
    var buckets = this.symbolBuckets;

    for (var i = buckets.length - 1; i >= 0; i--) {
        buckets[i].placeFeatures(collisionTile, showCollisionBoxes);
    }

    return {
        result: {
            buckets: buckets.filter(isBucketEmpty).map(serializeBucket)
        },
        transferables: getTransferables(buckets)
    };
};

function isBucketEmpty(bucket) {
    for (var bufferName in bucket.buffers) {
        if (bucket.buffers[bufferName].length > 0) return true;
    }
    return false;
}

function serializeBucket(bucket) {
    return bucket.serialize();
}

function getTransferables(buckets) {
    var transferables = [];
    for (var i in buckets) {
        var bucket = buckets[i];
        for (var j in bucket.buffers) {
            transferables.push(bucket.buffers[j].arrayBuffer);
        }
    }
    return transferables;
}

WorkerTile.prototype.querySourceFeatures = function(params) {
    if (!this.data) return null;

    var layer = this.data.layers ?
        this.data.layers[params.sourceLayer] :
        this.data;

    if (!layer) return null;

    var filter = featureFilter(params.filter);

    var features = [];
    for (var i = 0; i < layer.length; i++) {
        var feature = layer.feature(i);
        if (filter(feature)) {
            var geojsonFeature = feature.toGeoJSON(this.coord.x, this.coord.y, this.coord.z);
            geojsonFeature.tile = { z: this.coord.z, x: this.coord.x, y: this.coord.y };
            features.push(geojsonFeature);
        }
    }

    return features;
};
