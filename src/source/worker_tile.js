// @flow

const FeatureIndex = require('../data/feature_index');
const CollisionTile = require('../symbol/collision_tile');
const CollisionBoxArray = require('../symbol/collision_box');
const DictionaryCoder = require('../util/dictionary_coder');
const SymbolBucket = require('../data/bucket/symbol_bucket');
const util = require('../util/util');
const assert = require('assert');
const {makeImageAtlas} = require('../render/image_atlas');
const {makeGlyphAtlas} = require('../render/glyph_atlas');

import type TileCoord from './tile_coord';
import type {Bucket} from '../data/bucket';
import type Actor from '../util/actor';
import type StyleLayerIndex from '../style/style_layer_index';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type {
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';

class WorkerTile {
    coord: TileCoord;
    uid: string;
    zoom: number;
    pixelRatio: number;
    tileSize: number;
    source: string;
    overscaling: number;
    angle: number;
    pitch: number;
    cameraToCenterDistance: number;
    cameraToTileDistance: number;
    showCollisionBoxes: boolean;

    status: 'parsing' | 'done';
    data: VectorTile;
    collisionBoxArray: CollisionBoxArray;
    symbolBuckets: Array<SymbolBucket>;

    abort: ?() => void;
    reloadCallback: WorkerTileCallback;
    vectorTile: VectorTile;

    constructor(params: WorkerTileParameters) {
        this.coord = params.coord;
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.overscaling = params.overscaling;
        this.angle = params.angle;
        this.pitch = params.pitch;
        this.cameraToCenterDistance = params.cameraToCenterDistance;
        this.cameraToTileDistance = params.cameraToTileDistance;
        this.showCollisionBoxes = params.showCollisionBoxes;
    }

    parse(data: VectorTile, layerIndex: StyleLayerIndex, actor: Actor, callback: WorkerTileCallback) {
        this.status = 'parsing';
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

        const featureIndex = new FeatureIndex(this.coord, this.overscaling);
        featureIndex.bucketLayerIDs = [];

        const buckets: {[string]: Bucket} = {};

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
                util.warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                    `does not use vector tile spec v2 and therefore may have some rendering errors.`);
            }

            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                features.push({ feature, index, sourceLayerIndex });
            }

            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];

                assert(layer.source === this.source);
                if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) continue;
                if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
                if (layer.layout && layer.layout.visibility === 'none') continue;

                for (const layer of family) {
                    layer.recalculate(this.zoom);
                }

                const bucket = buckets[layer.id] = layer.createBucket({
                    index: featureIndex.bucketLayerIDs.length,
                    layers: family,
                    zoom: this.zoom,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray
                });

                bucket.populate(features, options);
                featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
            }
        }

        // Symbol buckets must be placed in reverse order.
        this.symbolBuckets = [];
        for (let i = layerIndex.symbolOrder.length - 1; i >= 0; i--) {
            const bucket = buckets[layerIndex.symbolOrder[i]];
            if (bucket) {
                assert(bucket instanceof SymbolBucket);
                this.symbolBuckets.push(((bucket: any): SymbolBucket));
            }
        }

        let error: ?Error;
        let glyphMap: ?{[string]: {[number]: ?StyleGlyph}};
        let imageMap: ?{[string]: StyleImage};

        const stacks = util.mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
        if (Object.keys(stacks).length) {
            actor.send('getGlyphs', {uid: this.uid, stacks}, (err, result) => {
                if (!error) {
                    error = err;
                    glyphMap = result;
                    maybePrepare.call(this);
                }
            });
        } else {
            glyphMap = {};
        }

        const icons = Object.keys(options.iconDependencies);
        if (icons.length) {
            actor.send('getImages', {icons}, (err, result) => {
                if (!error) {
                    error = err;
                    imageMap = result;
                    maybePrepare.call(this);
                }
            });
        } else {
            imageMap = {};
        }

        maybePrepare.call(this);

        function maybePrepare() {
            if (error) {
                return callback(error);
            } else if (glyphMap && imageMap) {
                const collisionTile = new CollisionTile(
                    this.angle,
                    this.pitch,
                    this.cameraToCenterDistance,
                    this.cameraToTileDistance,
                    this.collisionBoxArray);

                const glyphAtlas = makeGlyphAtlas(glyphMap);
                const imageAtlas = makeImageAtlas(imageMap);

                for (const bucket of this.symbolBuckets) {
                    recalculateLayers(bucket, this.zoom);

                    bucket.prepare(glyphMap, glyphAtlas.positions,
                                   imageMap, imageAtlas.positions);

                    bucket.place(collisionTile, this.showCollisionBoxes);
                }

                this.status = 'done';

                const transferables = [
                    glyphAtlas.image.data.buffer,
                    imageAtlas.image.data.buffer
                ];

                callback(null, {
                    buckets: serializeBuckets(util.values(buckets), transferables),
                    featureIndex: featureIndex.serialize(transferables),
                    collisionTile: collisionTile.serialize(transferables),
                    collisionBoxArray: this.collisionBoxArray.serialize(),
                    glyphAtlasImage: glyphAtlas.image,
                    iconAtlasImage: imageAtlas.image
                }, transferables);
            }
        }
    }

    redoPlacement(angle: number, pitch: number, cameraToCenterDistance: number, cameraToTileDistance: number, showCollisionBoxes: boolean) {
        this.angle = angle;
        this.pitch = pitch;
        this.cameraToCenterDistance = cameraToCenterDistance;
        this.cameraToTileDistance = cameraToTileDistance;

        if (this.status !== 'done') {
            return {};
        }

        const collisionTile = new CollisionTile(
            this.angle,
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

function recalculateLayers(bucket: SymbolBucket, zoom: number) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    for (const layer of bucket.layers) {
        layer.recalculate(zoom);
    }
}

function serializeBuckets(buckets: $ReadOnlyArray<Bucket>, transferables: Array<Transferable>) {
    return buckets
        .filter((b) => !b.isEmpty())
        .map((b) => b.serialize(transferables));
}

module.exports = WorkerTile;
