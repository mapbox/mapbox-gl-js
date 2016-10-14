'use strict';

const FeatureIndex = require('../data/feature_index');
const CollisionTile = require('../symbol/collision_tile');
const Bucket = require('../data/bucket');
const CollisionBoxArray = require('../symbol/collision_box');
const DictionaryCoder = require('../util/dictionary_coder');
const util = require('../util/util');
const SymbolInstancesArray = require('../symbol/symbol_instances');
const SymbolQuadsArray = require('../symbol/symbol_quads');
const assert = require('assert');

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

WorkerTile.prototype.parse = function(data, layerFamilies, actor, callback) {
    // Normalize GeoJSON data.
    if (!data.layers) {
        data = { layers: { '_geojsonTileLayer': data } };
    }

    this.status = 'parsing';
    this.data = data;

    this.collisionBoxArray = new CollisionBoxArray();
    this.symbolInstancesArray = new SymbolInstancesArray();
    this.symbolQuadsArray = new SymbolQuadsArray();
    const collisionTile = new CollisionTile(this.angle, this.pitch, this.collisionBoxArray);
    const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

    const featureIndex = new FeatureIndex(this.coord, this.overscaling, collisionTile, data.layers);
    featureIndex.bucketLayerIDs = {};

    const buckets = [];
    const bucketsBySourceLayer = {};

    // Map non-ref layers to buckets.
    let bucketIndex = 0;
    for (const layerId in layerFamilies) {
        const layer = layerFamilies[layerId][0];
        const sourceLayerId = layer.sourceLayer || '_geojsonTileLayer';

        assert(!layer.ref);

        if (layer.source !== this.source) continue;
        if (layer.minzoom && this.zoom < layer.minzoom) continue;
        if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
        if (layer.layout && layer.layout.visibility === 'none') continue;
        if (!data.layers[sourceLayerId]) continue;

        const bucket = Bucket.create({
            layer: layer,
            index: bucketIndex++,
            childLayers: layerFamilies[layerId],
            zoom: this.zoom,
            overscaling: this.overscaling,
            showCollisionBoxes: this.showCollisionBoxes,
            collisionBoxArray: this.collisionBoxArray,
            symbolQuadsArray: this.symbolQuadsArray,
            symbolInstancesArray: this.symbolInstancesArray,
            sourceLayerIndex: sourceLayerCoder.encode(sourceLayerId)
        });

        featureIndex.bucketLayerIDs[bucket.index] = bucket.childLayers.map(getLayerId);

        buckets.push(bucket);

        bucketsBySourceLayer[sourceLayerId] = bucketsBySourceLayer[sourceLayerId] || [];
        bucketsBySourceLayer[sourceLayerId].push(bucket);
    }

    // read each layer, and sort its features into buckets
    for (const sourceLayerId in bucketsBySourceLayer) {
        const sourceLayer = data.layers[sourceLayerId];
        if (sourceLayer.version === 1) {
            util.warnOnce(
                `Vector tile source "${this.source}" layer "${
                sourceLayerId}" does not use vector tile spec v2 ` +
                `and therefore may have some rendering errors.`
            );
        }
        const buckets = bucketsBySourceLayer[sourceLayerId];
        for (let i = 0; i < sourceLayer.length; i++) {
            const feature = sourceLayer.feature(i);
            feature.index = i;
            for (const bucket of buckets) {
                if (bucket.layer.filter(feature)) {
                    bucket.features.push(feature);
                }
            }
        }
    }

    const symbolBuckets = this.symbolBuckets = [];

    for (const bucket of buckets) {
        if (bucket.type === 'symbol') {
            symbolBuckets.push(bucket);
        } else {
            // immediately parse non-symbol buckets (they have no dependencies)
            bucket.populateArrays();

            for (const feature of bucket.features) {
                featureIndex.insert(feature, feature.index, bucket.sourceLayerIndex, bucket.index);
            }

            bucket.features = null;
        }
    }

    const done = () => {
        this.status = 'done';

        if (this.redoPlacementAfterDone) {
            this.redoPlacement(this.angle, this.pitch, null);
            this.redoPlacementAfterDone = false;
        }

        const featureIndex_ = featureIndex.serialize();
        const collisionTile_ = collisionTile.serialize();
        const collisionBoxArray = this.collisionBoxArray.serialize();
        const symbolInstancesArray = this.symbolInstancesArray.serialize();
        const symbolQuadsArray = this.symbolQuadsArray.serialize();
        const nonEmptyBuckets = buckets.filter(isBucketNonEmpty);

        callback(null, {
            buckets: nonEmptyBuckets.map(serializeBucket),
            featureIndex: featureIndex_.data,
            collisionTile: collisionTile_.data,
            collisionBoxArray: collisionBoxArray,
            symbolInstancesArray: symbolInstancesArray,
            symbolQuadsArray: symbolQuadsArray
        }, getTransferables(nonEmptyBuckets)
            .concat(featureIndex_.transferables)
            .concat(collisionTile_.transferables));
    };

    if (symbolBuckets.length === 0) {
        return done();
    }

    let icons = {};
    let stacks = {};
    let deps = 0;

    // Get dependencies for symbol buckets
    for (const bucket of symbolBuckets) {
        bucket.updateIcons(icons);
        bucket.updateFont(stacks);
    }

    for (const fontName in stacks) {
        stacks[fontName] = Object.keys(stacks[fontName]).map(Number);
    }

    icons = Object.keys(icons);

    const gotDependency = (err) => {
        if (err) return callback(err);
        deps++;
        if (deps === 2) {
            // all symbol bucket dependencies fetched; parse them in proper order
            for (let i = symbolBuckets.length - 1; i >= 0; i--) {
                const bucket = symbolBuckets[i];
                bucket.populateArrays(collisionTile, stacks, icons);
                bucket.features = null;
            }
            done();
        }
    };

    actor.send('get glyphs', {uid: this.uid, stacks: stacks}, (err, newStacks) => {
        stacks = newStacks;
        gotDependency(err);
    });

    if (icons.length) {
        actor.send('get icons', {icons: icons}, (err, newIcons) => {
            icons = newIcons;
            gotDependency(err);
        });
    } else {
        gotDependency();
    }
};

WorkerTile.prototype.redoPlacement = function(angle, pitch, showCollisionBoxes) {
    if (this.status !== 'done') {
        this.redoPlacementAfterDone = true;
        this.angle = angle;
        return {};
    }

    const collisionTile = new CollisionTile(angle, pitch, this.collisionBoxArray);

    const buckets = this.symbolBuckets;

    for (let i = buckets.length - 1; i >= 0; i--) {
        buckets[i].placeFeatures(collisionTile, showCollisionBoxes);
    }

    const collisionTile_ = collisionTile.serialize();
    const nonEmptyBuckets = buckets.filter(isBucketNonEmpty);

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
    const transferables = [];
    for (const i in buckets) {
        buckets[i].getTransferables(transferables);
    }
    return transferables;
}

function getLayerId(layer) {
    return layer.id;
}
