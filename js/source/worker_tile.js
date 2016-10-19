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

class WorkerTile {
    constructor(params) {
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

    parse(data, layerFamilies, actor, callback) {
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

        const layerFamiliesBySourceLayer = {};

        for (const family of layerFamilies) {
            const layer = family[0];
            const sourceLayerId = layer.sourceLayer || '_geojsonTileLayer';

            assert(!layer.ref);

            if (layer.source !== this.source) continue;
            if (layer.minzoom && this.zoom < layer.minzoom) continue;
            if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
            if (layer.layout && layer.layout.visibility === 'none') continue;
            if (!data.layers[sourceLayerId]) continue;

            let familyGroup = layerFamiliesBySourceLayer[sourceLayerId];
            if (!familyGroup) {
                familyGroup = layerFamiliesBySourceLayer[sourceLayerId] = [];
            }
            familyGroup.push(family);
        }

        const featureIndex = new FeatureIndex(this.coord, this.overscaling, collisionTile, data.layers);
        featureIndex.bucketLayerIDs = {};

        const buckets = [];
        const symbolBuckets = this.symbolBuckets = [];

        let icons = {};
        let stacks = {};
        const dependencies = {icons, stacks};

        for (const sourceLayerId in layerFamiliesBySourceLayer) {
            const families = layerFamiliesBySourceLayer[sourceLayerId];
            const sourceLayer = data.layers[sourceLayerId];

            if (!sourceLayer) {
                continue;
            }

            if (sourceLayer.version === 1) {
                util.warnOnce(
                    `Vector tile source "${this.source}" layer "${
                    sourceLayerId}" does not use vector tile spec v2 ` +
                    `and therefore may have some rendering errors.`
                );
            }

            const features = [];
            for (let i = 0; i < sourceLayer.length; i++) {
                const feature = sourceLayer.feature(i);
                feature.index = i;
                features.push(feature);
            }

            for (const family of families) {
                const bucket = Bucket.create({
                    layer: family[0],
                    index: buckets.length,
                    childLayers: family,
                    zoom: this.zoom,
                    overscaling: this.overscaling,
                    showCollisionBoxes: this.showCollisionBoxes,
                    collisionBoxArray: this.collisionBoxArray,
                    symbolQuadsArray: this.symbolQuadsArray,
                    symbolInstancesArray: this.symbolInstancesArray,
                    sourceLayerIndex: sourceLayerCoder.encode(sourceLayerId),
                    featureIndex: featureIndex
                });

                bucket.populate(features, dependencies);
                featureIndex.bucketLayerIDs[bucket.index] = family.map(getLayerId);

                buckets.push(bucket);

                if (bucket.type === 'symbol') {
                    symbolBuckets.push(bucket);
                }
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

        let deps = 0;

        const gotDependency = (err) => {
            if (err) return callback(err);
            deps++;
            if (deps === 2) {
                // all symbol bucket dependencies fetched; parse them in proper order
                for (let i = symbolBuckets.length - 1; i >= 0; i--) {
                    const bucket = symbolBuckets[i];
                    bucket.prepare(stacks, icons);
                    bucket.place(collisionTile, this.showCollisionBoxes);
                }
                done();
            }
        };

        for (const fontName in stacks) {
            stacks[fontName] = Object.keys(stacks[fontName]).map(Number);
        }

        if (Object.keys(stacks).length) {
            actor.send('getGlyphs', {uid: this.uid, stacks: stacks}, (err, newStacks) => {
                stacks = newStacks;
                gotDependency(err);
            });
        } else {
            gotDependency();
        }

        icons = Object.keys(icons);

        if (icons.length) {
            actor.send('getIcons', {icons: icons}, (err, newIcons) => {
                icons = newIcons;
                gotDependency(err);
            });
        } else {
            gotDependency();
        }
    }

    redoPlacement(angle, pitch, showCollisionBoxes) {
        if (this.status !== 'done') {
            this.redoPlacementAfterDone = true;
            this.angle = angle;
            return {};
        }

        const collisionTile = new CollisionTile(angle, pitch, this.collisionBoxArray);

        const buckets = this.symbolBuckets;

        for (let i = buckets.length - 1; i >= 0; i--) {
            buckets[i].place(collisionTile, showCollisionBoxes);
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
    }
}

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

module.exports = WorkerTile;
