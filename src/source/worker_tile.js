'use strict';

const FeatureIndex = require('../data/feature_index');
const CollisionTile = require('../symbol/collision_tile');
const CollisionBoxArray = require('../symbol/collision_box');
const DictionaryCoder = require('../util/dictionary_coder');
const util = require('../util/util');
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
        this.cameraToCenterDistance = params.cameraToCenterDistance;
        this.cameraToTileDistance = params.cameraToTileDistance;
        this.showCollisionBoxes = params.showCollisionBoxes;
    }

    parse(data, layerIndex, actor, callback) {
        // Normalize GeoJSON data.
        if (!data.layers) {
            data = { layers: { '_geojsonTileLayer': data } };
        }

        this.status = 'parsing';
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

        const featureIndex = new FeatureIndex(this.coord, this.overscaling);
        featureIndex.bucketLayerIDs = {};

        const buckets = {};
        let bucketIndex = 0;

        const options = {
            featureIndex: featureIndex,
            iconDependencies: {},
            glyphDependencies: {}
        };

        const layerFamilies = layerIndex.familiesBySource[this.source];
        for (const sourceLayerId in layerFamilies) {
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

            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features = [];
            for (let i = 0; i < sourceLayer.length; i++) {
                const feature = sourceLayer.feature(i);
                feature.index = i;
                feature.sourceLayerIndex = sourceLayerIndex;
                features.push(feature);
            }

            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];

                assert(layer.source === this.source);

                if (layer.minzoom && this.zoom < layer.minzoom) continue;
                if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
                if (layer.layout && layer.layout.visibility === 'none') continue;

                for (const layer of family) {
                    layer.recalculate(this.zoom);
                }

                const bucket = buckets[layer.id] = layer.createBucket({
                    index: bucketIndex,
                    layers: family,
                    zoom: this.zoom,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray
                });

                bucket.populate(features, options);
                featureIndex.bucketLayerIDs[bucketIndex] = family.map((l) => l.id);

                bucketIndex++;
            }
        }


        const done = (collisionTile) => {
            this.status = 'done';

            // collect data-driven paint property statistics from each bucket
            featureIndex.paintPropertyStatistics = {};
            for (const id in buckets) {
                util.extend(featureIndex.paintPropertyStatistics, buckets[id].getPaintPropertyStatistics());
            }

            const transferables = [];

            callback(null, {
                buckets: serializeBuckets(util.values(buckets), transferables),
                featureIndex: featureIndex.serialize(transferables),
                collisionTile: collisionTile.serialize(transferables),
                collisionBoxArray: this.collisionBoxArray.serialize()
            }, transferables);
        };

        // Symbol buckets must be placed in reverse order.
        this.symbolBuckets = [];
        for (let i = layerIndex.symbolOrder.length - 1; i >= 0; i--) {
            const bucket = buckets[layerIndex.symbolOrder[i]];
            if (bucket) {
                this.symbolBuckets.push(bucket);
            }
        }

        if (this.symbolBuckets.length === 0) {
            return done(new CollisionTile(this.angle, this.pitch, this.cameraToCenterDistance, this.cameraToTileDistance, this.collisionBoxArray));
        }

        let deps = 0;
        let icons = Object.keys(options.iconDependencies);
        let stacks = util.mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));

        const gotDependency = (err) => {
            if (err) return callback(err);
            deps++;
            if (deps === 2) {
                const collisionTile = new CollisionTile(this.angle,
                                                        this.pitch,
                                                        this.cameraToCenterDistance,
                                                        this.cameraToTileDistance,
                                                        this.collisionBoxArray);

                for (const bucket of this.symbolBuckets) {
                    recalculateLayers(bucket, this.zoom);

                    bucket.prepare(stacks, icons);
                    bucket.place(collisionTile, this.showCollisionBoxes);
                }

                done(collisionTile);
            }
        };

        if (Object.keys(stacks).length) {
            actor.send('getGlyphs', {uid: this.uid, stacks: stacks}, (err, newStacks) => {
                stacks = newStacks;
                gotDependency(err);
            });
        } else {
            gotDependency();
        }

        if (icons.length) {
            actor.send('getIcons', {icons: icons}, (err, newIcons) => {
                icons = newIcons;
                gotDependency(err);
            });
        } else {
            gotDependency();
        }
    }

    redoPlacement(angle, pitch, cameraToCenterDistance, cameraToTileDistance, showCollisionBoxes) {
        this.angle = angle;
        this.pitch = pitch;
        this.cameraToCenterDistance = cameraToCenterDistance;
        this.cameraToTileDistance = cameraToTileDistance;

        if (this.status !== 'done') {
            return {};
        }

        const collisionTile = new CollisionTile(this.angle,
                                                this.pitch,
                                                this.cameraToCenterDistance,
                                                this.cameraToTileDistance,
                                                this.collisionBoxArray);

        for (const bucket of this.symbolBuckets) {
            recalculateLayers(bucket, this.zoom);

            bucket.place(collisionTile, showCollisionBoxes);
        }

        const transferables = [];
        return {
            result: {
                buckets: serializeBuckets(this.symbolBuckets, transferables),
                collisionTile: collisionTile.serialize(transferables)
            },
            transferables: transferables
        };
    }
}

function recalculateLayers(bucket, zoom) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    for (const layer of bucket.layers) {
        layer.recalculate(zoom);
    }
}

function serializeBuckets(buckets, transferables) {
    return buckets
        .filter((b) => !b.isEmpty())
        .map((b) => b.serialize(transferables));
}

module.exports = WorkerTile;
