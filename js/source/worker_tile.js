'use strict';

var FeatureIndex = require('../data/feature_index');
var CollisionTile = require('../symbol/collision_tile');
var Bucket = require('../data/bucket');
var CollisionBoxArray = require('../symbol/collision_box');
var DictionaryCoder = require('../util/dictionary_coder');
var util = require('../util/util');
var SymbolInstancesArray = require('../symbol/symbol_instances');
var SymbolQuadsArray = require('../symbol/symbol_quads');

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

WorkerTile.prototype.parse = function(data, layerFamilies, actor, rawTileData, callback) {

    this.status = 'parsing';
    this.data = data;

    this.collisionBoxArray = new CollisionBoxArray();
    this.symbolInstancesArray = new SymbolInstancesArray();
    this.symbolQuadsArray = new SymbolQuadsArray();
    var collisionTile = new CollisionTile(this.angle, this.pitch, this.collisionBoxArray);
    var featureIndex = new FeatureIndex(this.coord, this.overscaling, collisionTile, data.layers);
    var sourceLayerCoder = new DictionaryCoder(data.layers ? Object.keys(data.layers).sort() : ['_geojsonTileLayer']);

    var tile = this;
    var bucketsById = {};
    var bucketsBySourceLayer = {};
    var i;
    var layer;
    var sourceLayerId;
    var bucket;

    // Map non-ref layers to buckets.
    var bucketIndex = 0;
    for (var layerId in layerFamilies) {
        layer = layerFamilies[layerId][0];

        if (layer.source !== this.source) continue;
        if (layer.ref) continue;
        if (layer.minzoom && this.zoom < layer.minzoom) continue;
        if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
        if (layer.layout && layer.layout.visibility === 'none') continue;
        if (data.layers && !data.layers[layer.sourceLayer]) continue;

        bucket = Bucket.create({
            layer: layer,
            index: bucketIndex++,
            childLayers: layerFamilies[layerId],
            zoom: this.zoom,
            overscaling: this.overscaling,
            showCollisionBoxes: this.showCollisionBoxes,
            collisionBoxArray: this.collisionBoxArray,
            symbolQuadsArray: this.symbolQuadsArray,
            symbolInstancesArray: this.symbolInstancesArray,
            sourceLayerIndex: sourceLayerCoder.encode(layer.sourceLayer || '_geojsonTileLayer')
        });
        bucket.createFilter();

        bucketsById[layer.id] = bucket;

        if (data.layers) { // vectortile
            sourceLayerId = layer.sourceLayer;
            bucketsBySourceLayer[sourceLayerId] = bucketsBySourceLayer[sourceLayerId] || {};
            bucketsBySourceLayer[sourceLayerId][layer.id] = bucket;
        }
    }

    // read each layer, and sort its features into buckets
    if (data.layers) { // vectortile
        for (sourceLayerId in bucketsBySourceLayer) {
            if (layer.version === 1) {
                util.warnOnce(
                    'Vector tile source "' + this.source + '" layer "' +
                    sourceLayerId + '" does not use vector tile spec v2 ' +
                    'and therefore may have some rendering errors.'
                );
            }
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

    featureIndex.bucketLayerIDs = {};

    for (var id in bucketsById) {
        bucket = bucketsById[id];
        if (bucket.features.length === 0) continue;

        featureIndex.bucketLayerIDs[bucket.index] = bucket.childLayers.map(getLayerId);

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
        bucket.populateArrays(collisionTile, stacks, icons);


        if (bucket.type !== 'symbol') {
            for (var i = 0; i < bucket.features.length; i++) {
                var feature = bucket.features[i];
                featureIndex.insert(feature, feature.index, bucket.sourceLayerIndex, bucket.index);
            }
        }

        bucket.features = null;
    }

    function done() {
        tile.status = 'done';

        if (tile.redoPlacementAfterDone) {
            tile.redoPlacement(tile.angle, tile.pitch, null);
            tile.redoPlacementAfterDone = false;
        }

        var featureIndex_ = featureIndex.serialize();
        var collisionTile_ = collisionTile.serialize();
        var collisionBoxArray = tile.collisionBoxArray.serialize();
        var symbolInstancesArray = tile.symbolInstancesArray.serialize();
        var symbolQuadsArray = tile.symbolQuadsArray.serialize();
        var transferables = [rawTileData].concat(featureIndex_.transferables).concat(collisionTile_.transferables);
        var nonEmptyBuckets = buckets.filter(isBucketNonEmpty);

        callback(null, {
            buckets: nonEmptyBuckets.map(serializeBucket),
            featureIndex: featureIndex_.data,
            collisionTile: collisionTile_.data,
            collisionBoxArray: collisionBoxArray,
            symbolInstancesArray: symbolInstancesArray,
            symbolQuadsArray: symbolQuadsArray,
            rawTileData: rawTileData
        }, getTransferables(nonEmptyBuckets).concat(transferables));
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, showCollisionBoxes) {
    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    var collisionTile = new CollisionTile(angle, pitch, this.collisionBoxArray);

    var buckets = this.symbolBuckets;

    for (var i = buckets.length - 1; i >= 0; i--) {
        buckets[i].placeFeatures(collisionTile, showCollisionBoxes);
    }

    var collisionTile_ = collisionTile.serialize();
    var nonEmptyBuckets = buckets.filter(isBucketNonEmpty);

    return {
        result: {
            buckets: nonEmptyBuckets.map(serializeBucket),
            collisionTile: collisionTile_.data
        },
        transferables: getTransferables(nonEmptyBuckets).concat(collisionTile_.transferables)
    };
};

function isBucketNonEmpty(bucket) {
    return !bucket.isEmpty();
}

function serializeBucket(bucket) {
    return bucket.serialize();
}

function getTransferables(buckets) {
    var transferables = [];
    for (var i in buckets) {
        buckets[i].getTransferables(transferables);
    }
    return transferables;
}

function getLayerId(layer) {
    return layer.id;
}
