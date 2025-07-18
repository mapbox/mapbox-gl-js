import FeatureIndex from '../data/feature_index';
import {performSymbolLayout, postRasterizationSymbolLayout, type SymbolBucketData} from '../symbol/symbol_layout';
import {CollisionBoxArray} from '../data/array_types';
import DictionaryCoder from '../util/dictionary_coder';
import SymbolBucket from '../data/bucket/symbol_bucket';
import LineBucket from '../data/bucket/line_bucket';
import FillBucket from '../data/bucket/fill_bucket';
import FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import {warnOnce, mapObject} from '../util/util';
import assert from 'assert';
import LineAtlas from '../render/line_atlas';
import ImageAtlas, {getImagePosition, ICON_PADDING} from '../render/image_atlas';
import GlyphAtlas from '../render/glyph_atlas';
import EvaluationParameters from '../style/evaluation_parameters';
import {OverscaledTileID} from './tile_id';
import {PerformanceUtils, type PerformanceMark} from '../util/performance';
import tileTransform from '../geo/projection/tile_transform';
import {makeFQID} from "../util/fqid";
import {type SpritePositions} from '../util/image';
import {ElevationFeatures} from '../../3d-style/elevation/elevation_feature';
import {HD_ELEVATION_SOURCE_LAYER, PROPERTY_ELEVATION_ID} from '../../3d-style/elevation/elevation_constants';
import {ElevationPortalGraph} from '../../3d-style/elevation/elevation_graph';
import {ImageId} from '../style-spec/expression/types/image_id';

import type {VectorTile} from '@mapbox/vector-tile';
import type {CanonicalTileID} from './tile_id';
import type Projection from '../geo/projection/projection';
import type {Bucket, PopulateParameters, ImageDependenciesMap} from '../data/bucket';
import type Actor from '../util/actor';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type StyleLayerIndex from '../style/style_layer_index';
import type {StyleImage, StyleImageMap} from '../style/style_image';
import type {
    WorkerSourceVectorTileRequest,
    WorkerSourceVectorTileCallback,
} from '../source/worker_source';
import type {PromoteIdSpecification} from '../style-spec/types';
import type {TileTransform} from '../geo/projection/tile_transform';
import type {LUT} from "../util/lut";
import type {GlyphMap} from '../render/glyph_manager';
import type {ImagePositionMap} from '../render/image_atlas';
import type {RasterizedImageMap, ImageRasterizationTasks} from '../render/image_manager';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {StyleModelMap} from '../style/style_mode';

type RasterizationStatus = {iconsPending: boolean, patternsPending: boolean};
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
    worldview?: string | null;
    localizableLayerIds?: Set<string>;
    tileTransform: TileTransform;
    brightness: number;
    scaleFactor: number;

    status: 'parsing' | 'done';
    data: VectorTile;
    collisionBoxArray: CollisionBoxArray;

    abort: () => void | null | undefined;
    reloadCallback?: WorkerSourceVectorTileCallback | null | undefined;
    vectorTile: VectorTile;
    rasterizeTask: {cancel: () => void} | null | undefined;

    constructor(params: WorkerSourceVectorTileRequest) {
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
        this.collectResourceTiming = params.request ? params.request.collectResourceTiming : false;
        this.promoteId = params.promoteId;
        this.isSymbolTile = params.isSymbolTile;
        this.tileTransform = tileTransform(params.tileID.canonical, params.projection);
        this.projection = params.projection;
        this.worldview = params.worldview;
        this.localizableLayerIds = params.localizableLayerIds;
        this.brightness = params.brightness;
        this.extraShadowCaster = !!params.extraShadowCaster;
        this.tessellationStep = params.tessellationStep;
        this.scaleFactor = params.scaleFactor;
        this.worldview = params.worldview;
    }

    parse(data: VectorTile, layerIndex: StyleLayerIndex, availableImages: ImageId[], availableModels: StyleModelMap, actor: Actor, callback: WorkerSourceVectorTileCallback) {
        const m = PerformanceUtils.beginMeasure('parseTile1');
        this.status = 'parsing';
        this.data = data;

        this.collisionBoxArray = new CollisionBoxArray();
        const sourceLayerCoder = new DictionaryCoder(Object.keys(data.layers).sort());

        const featureIndex = new FeatureIndex(this.tileID, this.promoteId);
        featureIndex.bucketLayerIDs = [];

        const buckets: Record<string, Bucket> = {};

        // we initially reserve space for a 256x256 atlas, but trim it after processing all line features
        const lineAtlas = new LineAtlas(256, 256);

        const options: PopulateParameters = {
            featureIndex,
            iconDependencies: new Map(),
            patternDependencies: new Map(),
            glyphDependencies: {},
            lineAtlas,
            availableImages,
            brightness: this.brightness,
            scaleFactor: this.scaleFactor,
            elevationFeatures: undefined
        };

        const asyncBucketLoads: Promise<unknown>[] = [];
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
            let elevationDependency = false;
            for (let index = 0, currentFeatureIndex = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                const id = featureIndex.getId(feature, sourceLayerId);

                // Handle feature localization based on the map worldview:
                // 1. If the feature layer is localizable, check if it has a 'worldview' property
                // 2. Check if the feature worldview is 'all' (visible in all worldviews) or matches the current map worldview
                // 3. Mark the feature with '$localized' property or skip it otherwise
                if (this.localizableLayerIds && this.localizableLayerIds.has(sourceLayerId)) {
                    const worldview = feature.properties ? feature.properties.worldview : null;
                    if (this.worldview && typeof worldview === 'string') {
                        if (worldview === 'all') {
                            feature.properties['$localized'] = true;
                        } else if (worldview.split(',').includes(this.worldview)) {
                            feature.properties['$localized'] = true;
                            feature.properties['worldview'] = this.worldview;
                        } else {
                            continue; // Skip features that don't match the current worldview
                        }
                    }
                }

                if (!elevationDependency && feature.properties && feature.properties.hasOwnProperty(PROPERTY_ELEVATION_ID)) {
                    elevationDependency = true;
                }

                features.push({feature, id, index: currentFeatureIndex, sourceLayerIndex});
                currentFeatureIndex++;
            }

            if (elevationDependency && !options.elevationFeatures && data.layers.hasOwnProperty(HD_ELEVATION_SOURCE_LAYER)) {
                options.elevationFeatures = ElevationFeatures.parseFrom(data.layers[HD_ELEVATION_SOURCE_LAYER], this.canonical);
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

                recalculateLayers(family, this.zoom, options.brightness, availableImages, this.worldview);

                // @ts-expect-error: Type 'TypedStyleLayer' doesn't have a 'createBucket' method in all of its subtypes
                const bucket: Bucket = buckets[layer.id] = layer.createBucket({
                    index: featureIndex.bucketLayerIDs.length,
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
                    tessellationStep: this.tessellationStep,
                    styleDefinedModelURLs: availableModels,
                    worldview: this.worldview
                });

                assert(this.tileTransform.projection.name === this.projection.name);
                featureIndex.bucketLayerIDs.push(family.map((l) => makeFQID(l.id, l.scope)));

                let bucketPromise = bucket.prepare ? bucket.prepare() : null;
                if (bucketPromise != null) {
                    bucketPromise = bucketPromise.then(() => bucket.populate(features, options, this.tileID.canonical, this.tileTransform));
                    asyncBucketLoads.push(bucketPromise);
                } else {
                    bucket.populate(features, options, this.tileID.canonical, this.tileTransform);
                }
            }
        }

        const prepareTile = () => {
            lineAtlas.trim();

            let error: Error | null | undefined;
            let glyphMap: GlyphMap;
            let iconMap: StyleImageMap<StringifiedImageVariant>;
            let patternMap: StyleImageMap<StringifiedImageVariant>;
            let iconRasterizationTasks: ImageRasterizationTasks;
            let patternRasterizationTasks: ImageRasterizationTasks;
            const taskMetadata = {type: 'maybePrepare', isSymbolTile: this.isSymbolTile, zoom: this.zoom} as const;

            const maybePrepare = () => {
                if (error) {
                    this.status = 'done';
                    return callback(error);
                } else if (this.extraShadowCaster) {
                    const m = PerformanceUtils.beginMeasure('parseTile2');
                    this.status = 'done';
                    callback(null, {
                        buckets: Object.values(buckets).filter(b => !b.isEmpty()),
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

                    const iconPositions: ImagePositionMap = new Map();
                    for (const [id, icon] of iconMap.entries()) {
                        const {imagePosition} = getImagePosition(id, icon, ICON_PADDING);
                        iconPositions.set(id, imagePosition);
                    }

                    const symbolLayoutData: Record<string, SymbolBucketData> = {};
                    for (const key in buckets) {
                        const bucket = buckets[key];
                        if (bucket instanceof SymbolBucket) {
                            recalculateLayers(bucket.layers, this.zoom, options.brightness, availableImages, this.worldview);
                            symbolLayoutData[key] =
                            performSymbolLayout(bucket,
                                    glyphMap,
                                    glyphAtlas.positions,
                                    iconMap,
                                    iconPositions,
                                    this.tileID.canonical,
                                    this.tileZoom,
                                    this.scaleFactor,
                                    this.pixelRatio,
                                    iconRasterizationTasks,
                                    this.worldview);
                        }
                    }

                    const rasterizationStatus: RasterizationStatus = {iconsPending: true, patternsPending: true};
                    this.rasterizeIfNeeded(actor, iconMap, iconRasterizationTasks, () => {
                        rasterizationStatus.iconsPending = false;
                        postRasterizationLayout(symbolLayoutData, glyphAtlas, rasterizationStatus, m);
                    });
                    this.rasterizeIfNeeded(actor, patternMap, patternRasterizationTasks, () => {
                        rasterizationStatus.patternsPending = false;
                        postRasterizationLayout(symbolLayoutData, glyphAtlas, rasterizationStatus, m);
                    });

                }
            };

            const postRasterizationLayout = (symbolLayoutData: Record<string, SymbolBucketData>, glyphAtlas: GlyphAtlas, rasterizationStatus: RasterizationStatus, m: PerformanceMark) => {
                if (rasterizationStatus.iconsPending || rasterizationStatus.patternsPending) return;
                const imageAtlas = new ImageAtlas(iconMap, patternMap, this.lut);
                for (const key in buckets) {
                    const bucket = buckets[key];
                    if (key in symbolLayoutData) {
                        postRasterizationSymbolLayout(bucket as SymbolBucket, symbolLayoutData[key], this.showCollisionBoxes, availableImages, this.tileID.canonical, this.tileZoom, this.projection, this.brightness, iconMap, imageAtlas);
                    } else if (bucket.hasPattern &&
                        (bucket instanceof LineBucket ||
                            bucket instanceof FillBucket ||
                            bucket instanceof FillExtrusionBucket)) {
                        recalculateLayers(bucket.layers, this.zoom, options.brightness, availableImages, this.worldview);
                        const imagePositions: SpritePositions = Object.fromEntries(imageAtlas.patternPositions);
                        bucket.addFeatures(options, this.tileID.canonical, imagePositions, availableImages, this.tileTransform, this.brightness);
                    }
                }

                this.status = 'done';
                callback(null, {
                    buckets: Object.values(buckets).filter(b => !b.isEmpty()),
                    featureIndex,
                    collisionBoxArray: this.collisionBoxArray,
                    glyphAtlasImage: glyphAtlas.image,
                    lineAtlas,
                    imageAtlas,
                    brightness: options.brightness
                });
                PerformanceUtils.endMeasure(m);
            };

            if (!this.extraShadowCaster) {
                const stacks = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
                if (Object.keys(stacks).length) {
                    actor.send('getGlyphs', {uid: this.uid, stacks}, (err, result: GlyphMap) => {
                        if (!error) {
                            error = err;
                            glyphMap = result;
                            maybePrepare();
                        }
                    }, undefined, false, taskMetadata);
                } else {
                    glyphMap = {};
                }

                const images = Array.from(options.iconDependencies.keys()).map((id) => ImageId.parse(id));
                if (images.length) {
                    const params = {images, source: this.source, scope: this.scope, tileID: this.tileID, type: 'icons'} as const;
                    actor.send('getImages', params, (err: Error, result: StyleImageMap<StringifiedImageId>) => {
                        if (error) {
                            return;
                        }

                        error = err;
                        iconMap = new Map();
                        iconRasterizationTasks = this.updateImageMapAndGetImageTaskQueue(iconMap, result, options.iconDependencies);
                        maybePrepare();
                    }, undefined, false, taskMetadata);
                } else {
                    iconMap = new Map();
                    iconRasterizationTasks = new Map();
                }

                const patterns = Array.from(options.patternDependencies.keys()).map((id) => ImageId.parse(id));
                if (patterns.length) {
                    const params = {images: patterns, source: this.source, scope: this.scope, tileID: this.tileID, type: 'patterns'} as const;
                    actor.send('getImages', params, (err: Error, result: StyleImageMap<StringifiedImageId>) => {
                        if (error) {
                            return;
                        }

                        error = err;
                        patternMap = new Map();
                        patternRasterizationTasks = this.updateImageMapAndGetImageTaskQueue(patternMap, result, options.patternDependencies);
                        maybePrepare();
                    }, undefined, false, taskMetadata);
                } else {
                    patternMap = new Map();
                    patternRasterizationTasks = new Map();
                }
            }

            if (options.elevationFeatures && options.elevationFeatures.length > 0) {
                // Multiple layers might contribute to the elevation of this tile. For this reason we need to combine
                // unevaluated portals from available buckets into single graph that describes polygon connectivity of the whole
                // tile
                const unevaluatedPortals = [];

                for (const bucket of Object.values(buckets)) {
                    if (bucket instanceof FillBucket) {
                        const graph = bucket.getUnevaluatedPortalGraph();
                        if (graph) {
                            unevaluatedPortals.push(graph);
                        }
                    }
                }

                const evaluatedPortals = ElevationPortalGraph.evaluate(unevaluatedPortals);

                // Pass evaluated portals back to buckets and construct a separate acceleration structure
                // for elevation queries.
                for (const bucket of Object.values(buckets)) {
                    if (bucket instanceof FillBucket) {
                        const vtLayer = data.layers[sourceLayerCoder.decode(bucket.sourceLayerIndex)];
                        assert(vtLayer);
                        bucket.setEvaluatedPortalGraph(evaluatedPortals, vtLayer, this.tileID.canonical, options.availableImages, options.brightness);
                    }
                }
            }

            PerformanceUtils.endMeasure(m);

            maybePrepare();
        };

        if (asyncBucketLoads.length > 0) {
            Promise.allSettled(asyncBucketLoads)
                .then(prepareTile)
                .catch(callback);
        } else {
            prepareTile();
        }
    }

    rasterizeIfNeeded(actor: Actor, outputMap: StyleImageMap<StringifiedImageVariant> | undefined, tasks: ImageRasterizationTasks, callback: () => void) {
        const needRasterization = Array.from(outputMap.values()).some((image: StyleImage) => image.usvg);
        if (needRasterization) {
            this.rasterize(actor, outputMap, tasks, callback);
        } else {
            callback();
        }
    }

    updateImageMapAndGetImageTaskQueue(imageMap: StyleImageMap<StringifiedImageVariant>, images: StyleImageMap<StringifiedImageId>, imageDependencies: ImageDependenciesMap): ImageRasterizationTasks {
        const imageRasterizationTasks: ImageRasterizationTasks = new Map();
        for (const imageName of images.keys()) {
            const requiredImageVariants = imageDependencies.get(imageName) || [];
            for (const imageVariant of requiredImageVariants) {
                const imageVariantStr = imageVariant.toString();
                const image = images.get(imageVariant.id.toString());
                if (!image.usvg) {
                    imageMap.set(imageVariantStr, image);
                } else if (!imageRasterizationTasks.has(imageVariantStr)) {
                    imageRasterizationTasks.set(imageVariantStr, imageVariant);
                    imageMap.set(imageVariantStr, Object.assign({}, image));
                }
            }
        }

        return imageRasterizationTasks;
    }

    rasterize(actor: Actor, imageMap: StyleImageMap<StringifiedImageVariant>, tasks: ImageRasterizationTasks, callback: () => void) {
        this.rasterizeTask = actor.send('rasterizeImages', {scope: this.scope, tasks}, (err: Error, rasterizedImages: RasterizedImageMap) => {
            if (!err) {
                for (const [id, data] of rasterizedImages.entries()) {
                    const image = Object.assign(imageMap.get(id), {data});
                    imageMap.set(id, image);
                }
            }

            callback();
        });
    }

    cancelRasterize() {
        if (this.rasterizeTask) {
            this.rasterizeTask.cancel();
        }
    }
}

function recalculateLayers(layers: ReadonlyArray<TypedStyleLayer>, zoom: number, brightness: number, availableImages: ImageId[], worldview: string | undefined) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new EvaluationParameters(zoom, {brightness, worldview});
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}

export default WorkerTile;
