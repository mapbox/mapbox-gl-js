import FeatureIndex from '../data/feature_index';

import {performSymbolLayout} from '../symbol/symbol_layout';
import {CollisionBoxArray} from '../data/array_types';
import DictionaryCoder from '../util/dictionary_coder';
import SymbolBucket from '../data/bucket/symbol_bucket';
import LineBucket from '../data/bucket/line_bucket';
import FillBucket from '../data/bucket/fill_bucket';
import FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import {warnOnce, mapObject, values} from '../util/util';
import assert from 'assert';
import LineAtlas from '../render/line_atlas';
import ImageAtlas from '../render/image_atlas';
import GlyphAtlas from '../render/glyph_atlas';
import EvaluationParameters from '../style/evaluation_parameters';
import {CanonicalTileID, OverscaledTileID} from './tile_id';
import {PerformanceUtils} from '../util/performance';
import tileTransform from '../geo/projection/tile_transform';
import type Projection from '../geo/projection/projection';
import type {Bucket} from '../data/bucket';
import type Actor from '../util/actor';
import type StyleLayer from '../style/style_layer';
import type StyleLayerIndex from '../style/style_layer_index';
import type {StyleImage} from '../style/style_image';
import type {StyleGlyph} from '../style/style_glyph';
import type {SpritePositions} from '../util/image';
import type {
    WorkerTileParameters,
    WorkerTileCallback,
} from '../source/worker_source';
import type {PromoteIdSpecification} from '../style-spec/types';
import type {TileTransform} from '../geo/projection/tile_transform';
import type {VectorTile} from '@mapbox/vector-tile';
import type {LUT} from "../util/lut";

class WorkerTile {
    tileID: OverscaledTileID;
    uid: number;
    zoom: number;
    lut: LUT | null;
    tileZoom: number;
    canonical: CanonicalTileID;
    pixelRatio: number;
    tileSize: number;
    source: string;
    scope: string;
    promoteId: PromoteIdSpecification | null | undefined;
    overscaling: number;
    showCollisionBoxes: boolean;
    collectResourceTiming: boolean;
    isSymbolTile: boolean | null | undefined;
    extraShadowCaster: boolean | null | undefined;
    tessellationStep: number | null | undefined;
    projection: Projection;
    tileTransform: TileTransform;
    brightness: number;

    status: 'parsing' | 'done';
    data: VectorTile;
    collisionBoxArray: CollisionBoxArray;

    abort: () => void | null | undefined;
    reloadCallback: WorkerTileCallback | null | undefined;
    vectorTile: VectorTile;

    constructor(params: WorkerTileParameters) {
        this.tileID = new OverscaledTileID(params.tileID.overscaledZ, params.tileID.wrap, params.tileID.canonical.z, params.tileID.canonical.x, params.tileID.canonical.y);
        this.tileZoom = params.tileZoom;
        this.uid = params.uid;
        this.zoom = params.zoom;
        this.lut = params.lut;
        this.canonical = params.tileID.canonical;
        this.pixelRatio = params.pixelRatio;
        this.tileSize = params.tileSize;
        this.source = params.source;
        this.scope = params.scope;
        this.overscaling = this.tileID.overscaleFactor();
        this.showCollisionBoxes = params.showCollisionBoxes;
        this.collectResourceTiming = !!params.collectResourceTiming;
        this.promoteId = params.promoteId;
        this.isSymbolTile = params.isSymbolTile;
        this.tileTransform = tileTransform(params.tileID.canonical, params.projection);
        this.projection = params.projection;
        this.brightness = params.brightness;
        this.extraShadowCaster = !!params.extraShadowCaster;
        this.tessellationStep = params.tessellationStep;
    }

    parse(data: VectorTile, layerIndex: StyleLayerIndex, availableImages: Array<string>, actor: Actor, callback: WorkerTileCallback) {
        const m = PerformanceUtils.beginMeasure('parseTile1');
        this.status = 'parsing';
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

        const featureIndex = new FeatureIndex(this.tileID, this.promoteId);
        featureIndex.bucketLayerIDs = [];

        const buckets: {
            [_: string]: Bucket;
        } = {};

        // we initially reserve space for a 256x256 atlas, but trim it after processing all line features
        const lineAtlas = new LineAtlas(256, 256);

        const options = {
            featureIndex,
            iconDependencies: {},
            patternDependencies: {},
            glyphDependencies: {},
            lineAtlas,
            availableImages,
            brightness: this.brightness
        };

        const layerFamilies = layerIndex.familiesBySource[this.source];
        for (const sourceLayerId in layerFamilies) {
            const sourceLayer = data.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }

            let anySymbolLayers = false;
            let anyOtherLayers = false;
            let any3DLayer = false;

            for (const family of layerFamilies[sourceLayerId]) {
                if (family[0].type === 'symbol') {
                    anySymbolLayers = true;
                } else {
                    anyOtherLayers = true;
                }
                if (family[0].is3D() && family[0].type !== 'model') {
                    any3DLayer = true;
                }
            }

            if (this.extraShadowCaster && !any3DLayer) {
                continue;
            }

            if (this.isSymbolTile === true && !anySymbolLayers) {
                continue;
            } else if (this.isSymbolTile === false && !anyOtherLayers) {
                continue;
            }

            if (sourceLayer.version === 1) {
                warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                    `does not use vector tile spec v2 and therefore may have some rendering errors.`);
            }

            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features = [];
            for (let index = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                const id = featureIndex.getId(feature, sourceLayerId);
                features.push({feature, id, index, sourceLayerIndex});
            }

            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];

                if (this.extraShadowCaster && (!layer.is3D() || layer.type === 'model')) {
                    // avoid to spend resources in 2D layers or 3D model layers (trees) for extra shadow casters
                    continue;
                }
                if (this.isSymbolTile !== undefined && (layer.type === 'symbol') !== this.isSymbolTile) continue;
                assert(layer.source === this.source);
                if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) continue;
                if (layer.maxzoom && this.zoom >= layer.maxzoom) continue;
                if (layer.visibility === 'none') continue;

                recalculateLayers(family, this.zoom, options.brightness, availableImages);

                const bucket = buckets[layer.id] = layer.createBucket({
                    index: featureIndex.bucketLayerIDs.length,
                    // @ts-expect-error - TS2322 - Type 'Family<TypedStyleLayer>' is not assignable to type 'ClipStyleLayer[] & ModelStyleLayer[] & SymbolStyleLayer[] & LineStyleLayer[] & HeatmapStyleLayer[] & FillExtrusionStyleLayer[] & FillStyleLayer[] & CircleStyleLayer[]'.
                    layers: family,
                    zoom: this.zoom,
                    lut: this.lut,
                    canonical: this.canonical,
                    pixelRatio: this.pixelRatio,
                    overscaling: this.overscaling,
                    collisionBoxArray: this.collisionBoxArray,
                    sourceLayerIndex,
                    sourceID: this.source,
                    projection: this.projection.spec,
                    tessellationStep: this.tessellationStep
                });

                assert(this.tileTransform.projection.name === this.projection.name);
                bucket.populate(features, options, this.tileID.canonical, this.tileTransform);
                featureIndex.bucketLayerIDs.push(family.map((l) => l.id));
            }
        }

        lineAtlas.trim();

        let error: Error | null | undefined;
        let glyphMap: {
            [_: string]: {
                glyphs: {
                    [_: number]: StyleGlyph | null | undefined;
                };
                ascender?: number;
                descender?: number;
            };
        };
        let iconMap: {
            [_: string]: StyleImage;
        };
        let patternMap: {
            [_: string]: StyleImage;
        };
        const taskMetadata = {type: 'maybePrepare', isSymbolTile: this.isSymbolTile, zoom: this.zoom};

        const maybePrepare = () => {
            if (error) {
                this.status = 'done';
                return callback(error);
            } else if (this.extraShadowCaster) {
                const m = PerformanceUtils.beginMeasure('parseTile2');
                this.status = 'done';
                callback(null, {
                    buckets: values(buckets).filter(b => !b.isEmpty()),
                    featureIndex,
                    collisionBoxArray: null,
                    glyphAtlasImage: null,
                    lineAtlas: null,
                    imageAtlas: null,
                    brightness: options.brightness,
                    // Only used for benchmarking:
                    glyphMap: null,
                    iconMap: null,
                    glyphPositions: null
                });
                PerformanceUtils.endMeasure(m);
            } else if (glyphMap && iconMap && patternMap) {
                const m = PerformanceUtils.beginMeasure('parseTile2');
                const glyphAtlas = new GlyphAtlas(glyphMap);
                const imageAtlas = new ImageAtlas(iconMap, patternMap, this.lut);

                for (const key in buckets) {
                    const bucket = buckets[key];
                    if (bucket instanceof SymbolBucket) {
                        recalculateLayers(bucket.layers, this.zoom, options.brightness, availableImages);
                        performSymbolLayout(bucket,
                                glyphMap,
                                glyphAtlas.positions,
                                iconMap,
                                imageAtlas.iconPositions,
                                this.showCollisionBoxes,
                                availableImages,
                                this.tileID.canonical,
                                this.tileZoom,
                                this.projection,
                                this.brightness);
                    } else if (bucket.hasPattern &&
                            (bucket instanceof LineBucket ||
                             bucket instanceof FillBucket ||
                             bucket instanceof FillExtrusionBucket)) {
                        recalculateLayers(bucket.layers, this.zoom, options.brightness, availableImages);
                        const imagePositions: SpritePositions = imageAtlas.patternPositions;
                        bucket.addFeatures(options, this.tileID.canonical, imagePositions, availableImages, this.tileTransform, this.brightness);
                    }
                }
                this.status = 'done';
                callback(null, {
                    buckets: values(buckets).filter(b => !b.isEmpty()),
                    featureIndex,
                    collisionBoxArray: this.collisionBoxArray,
                    glyphAtlasImage: glyphAtlas.image,
                    lineAtlas,
                    imageAtlas,
                    brightness: options.brightness
                });
                PerformanceUtils.endMeasure(m);
            }
        };

        if (!this.extraShadowCaster) {
            const stacks = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
            if (Object.keys(stacks).length) {
                actor.send('getGlyphs', {uid: this.uid, stacks, scope: this.scope}, (err, result) => {
                    if (!error) {
                        error = err;
                        glyphMap = result;
                        maybePrepare();
                    }
                }, undefined, false, taskMetadata);
            } else {
                glyphMap = {};
            }

            const icons = Object.keys(options.iconDependencies);
            if (icons.length) {
                actor.send('getImages', {icons, source: this.source, scope: this.scope, tileID: this.tileID, type: 'icons'}, (err, result) => {
                    if (!error) {
                        error = err;
                        iconMap = result;
                        maybePrepare();
                    }
                }, undefined, false, taskMetadata);
            } else {
                iconMap = {};
            }

            const patterns = Object.keys(options.patternDependencies);
            if (patterns.length) {
                actor.send('getImages', {icons: patterns, source: this.source, scope: this.scope, tileID: this.tileID, type: 'patterns'}, (err, result) => {
                    if (!error) {
                        error = err;
                        patternMap = result;
                        maybePrepare();
                    }
                }, undefined, false, taskMetadata);
            } else {
                patternMap = {};
            }
        }

        PerformanceUtils.endMeasure(m);

        maybePrepare();

    }
}

function recalculateLayers(layers: ReadonlyArray<StyleLayer>, zoom: number, brightness: number, availableImages: Array<string>) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new EvaluationParameters(zoom, {brightness});
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}

export default WorkerTile;
