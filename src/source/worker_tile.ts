import FeatureIndex from '../data/feature_index';
import {performSymbolLayout, postRasterizationSymbolLayout, type SymbolBucketData} from '../symbol/symbol_layout';
import {CollisionBoxArray} from '../data/array_types';
import DictionaryCoder from '../util/dictionary_coder';
import SymbolBucket from '../data/bucket/symbol_bucket';
import LineBucket from '../data/bucket/line_bucket';
import FillBucket from '../data/bucket/fill_bucket';
import FillExtrusionBucket from '../data/bucket/fill_extrusion_bucket';
import {warnOnce, mapObject} from '../util/util';
import assert from '../style-spec/util/assert';
import LineAtlas from '../render/line_atlas';
import ImageAtlas, {ImageAtlasReference, getImagePosition, ICON_PADDING, sortImagesMap} from '../render/image_atlas';
import {AtlasContentDescriptor} from '../render/atlas_content_descriptor';
import GlyphAtlas from '../render/glyph_atlas';
import EvaluationParameters from '../style/evaluation_parameters';
import {OverscaledTileID} from './tile_id';
import {PerformanceUtils, type PerformanceMark} from '../util/performance';
import tileTransform from '../geo/projection/tile_transform';
import {makeFQID} from "../util/fqid";
import {type SpritePositions} from '../util/image';
import {PROPERTY_ELEVATION_ID} from '../../3d-style/elevation/elevation_constants';
import * as HD from '../../modules/hd_worker';
import * as Standard from '../../modules/standard_worker';
import {ImageId} from '../style-spec/expression/types/image_id';
import {RenderSourceType} from './render_source_type';
import {HD_ROAD_COVERAGE_SOURCE_LAYER} from './frc_coverage_snapshot';

import type {FrcCoveragePolygons, FrcCoverageParams} from './frc_coverage_snapshot';
import type {ElevationParams} from './elevation_coverage_snapshot';
import type {VectorTile} from '@mapbox/vector-tile';
import type {CanonicalTileID} from './tile_id';
import type Projection from '../geo/projection/projection';
import type {Bucket, PopulateParameters, ImageDependenciesMap, IndexedFeature} from '../data/bucket';
import type StyleLayer from '../style/style_layer';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type StyleLayerIndex from '../style/style_layer_index';
import type {StyleImageMap} from '../style/style_image';
import type {
    WorkerSourceVectorTileRequest,
    WorkerSourceVectorTileCallback,
    WorkerSourceActor,
} from '../source/worker_source';
import type {PromoteIdSpecification} from '../style-spec/types';
import type {TileTransform} from '../geo/projection/tile_transform';
import type {LUT} from "../util/lut";
import type {GlyphMap} from '../render/glyph_manager';
import type {ImagePositionMap} from '../render/image_atlas';
import type {ImageRasterizationTasks} from '../render/image_manager';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {ImageVariant, StringifiedImageVariant} from '../style-spec/expression/types/image_variant';
import type {StyleModelMap} from '../style/style_mode';
import type {IndoorTileOptions} from '../style/indoor_data';

// Check whether any bucket in a tile needs the HD module loaded on main before it can
// be deserialized. Covers two cases:
//   1. Fill/line/circle/symbol buckets carrying an `hdExt` — the extension class lives
//      only in the HD module, so `deserialize` throws "unregistered class" without it.
//   2. Buckets that advertise `requiresHDRuntime = true` — classes that live entirely
//      in the HD chunk (e.g. `BuildingBucket`) and cannot be reconstructed on main
//      without HD.
function anyBucketRequiresHD(buckets: Array<Bucket>): boolean {
    for (const bucket of buckets) {
        if ((bucket as {hdExt?: unknown}).hdExt != null) return true;
        if (bucket.requiresHDRuntime) return true;
    }
    return false;
}

function anyBucketRequiresStandard(buckets: Array<Bucket>): boolean {
    for (const bucket of buckets) {
        if (bucket.requiresStandardRuntime) return true;
    }
    return false;
}

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
    showElevationIdDebug: boolean;
    collectResourceTiming: boolean;
    renderSourceType: RenderSourceType | null | undefined;
    frcCoverage: FrcCoverageParams | null;
    elevation: ElevationParams | null;
    crossSourceElevationEnabled: boolean;
    terrainEnabled: boolean;
    deferRoadStructure: boolean;
    extraShadowCaster: boolean | null | undefined;
    tessellationStep: number | null | undefined;
    projection: Projection;
    worldview?: string | null;
    localizableLayerIds?: Set<string>;
    tileTransform: TileTransform;
    brightness: number;
    scaleFactor: number;
    indoor: IndoorTileOptions | null;
    maxUniformBufferBindings: number | null | undefined;
    maxUniformBlockSizeDwords: number | null | undefined;

    status: 'parsing' | 'done';
    data: VectorTile;
    collisionBoxArray: CollisionBoxArray;

    abort: () => void | null | undefined;
    reloadCallback?: WorkerSourceVectorTileCallback | null | undefined;
    vectorTile: VectorTile;
    rasterizeTask: AbortController | null | undefined;

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
        this.showElevationIdDebug = params.showElevationIdDebug;
        this.collectResourceTiming = params.request ? params.request.collectResourceTiming : false;
        this.promoteId = params.promoteId;
        this.renderSourceType = params.renderSourceType;
        this.frcCoverage = params.frcCoverage || null;
        this.elevation = params.elevation || null;
        this.crossSourceElevationEnabled = !!params.crossSourceElevationEnabled;
        this.terrainEnabled = !!params.terrainEnabled;
        this.deferRoadStructure = false;
        this.tileTransform = tileTransform(params.tileID.canonical, params.projection);
        this.projection = params.projection;
        this.worldview = params.worldview;
        this.localizableLayerIds = params.localizableLayerIds;
        this.brightness = params.brightness;
        this.extraShadowCaster = !!params.extraShadowCaster;
        this.tessellationStep = params.tessellationStep;
        this.scaleFactor = params.scaleFactor;
        this.worldview = params.worldview;
        this.indoor = params.indoor;
    }

    // Whether a layer would actually produce a bucket for this tile. Used to avoid
    // doing work (HD module load, bucket creation) for layers that are hidden, out of
    // zoom range, or irrelevant to this tile's render source type.
    isLayerActiveForTile(layer: TypedStyleLayer): boolean {
        if (this.renderSourceType === RenderSourceType.Symbol && layer.type !== 'symbol') return false;
        if (this.renderSourceType === RenderSourceType.FillExtrusion && layer.type !== 'fill-extrusion') return false;
        if (this.renderSourceType === RenderSourceType.Other && (layer.type === 'symbol' || layer.type === 'fill-extrusion')) return false;
        if (this.renderSourceType === RenderSourceType.HdRoadElevation) return false;
        if (layer.minzoom && this.zoom < Math.floor(layer.minzoom)) return false;
        if (layer.maxzoom && this.zoom >= layer.maxzoom) return false;
        if (layer.visibility === 'none') return false;
        return true;
    }

    parse(data: VectorTile, layerIndex: StyleLayerIndex, availableImages: ImageId[], availableModels: StyleModelMap, actor: WorkerSourceActor, callback: WorkerSourceVectorTileCallback) {
        // Tile-level HD gate. If any layer in this tile's source may use HD and the HD
        // module hasn't loaded yet on this worker, wait for it before parsing. Otherwise
        // the bucket creation loop would skip `HD.attachExtension` and any features that
        // rely on HD would render without elevation. Non-HD tiles bypass the gate
        // entirely and stay fully synchronous.
        const layerFamilies = layerIndex.familiesBySource[this.source];
        if ((layerFamilies || this.indoor) && (!HD.loaded || !Standard.loaded)) {
            let needsHD = !!this.indoor || !!this.frcCoverage; // Indoor needs HD.parseActiveFloors; FRC needs HD.attachExtension
            let needsStandard = false;
            for (const sourceLayerId in layerFamilies || {}) {
                for (const family of layerFamilies[sourceLayerId]) {
                    const layer = family[0];
                    // Layers that won't actually parse for this tile shouldn't force a
                    // module load. The same predicate is applied inside `_parseAfterHD`.
                    if (!this.isLayerActiveForTile(layer)) continue;
                    if (!HD.loaded && layer.mayUse('HD')) needsHD = true;
                    if (!Standard.loaded && layer.mayUse('Standard')) needsStandard = true;
                }
            }
            if (needsHD || needsStandard) {
                const proceed = () => this._parseAfterHD(data, layerIndex, availableImages, availableModels, actor, callback);
                const loads: Array<Promise<void>> = [];
                if (needsHD) loads.push(HD.prepareHD());
                if (needsStandard) loads.push(Standard.prepareStandard());
                Promise.all(loads).then(proceed, proceed);
                return;
            }
        }
        this._parseAfterHD(data, layerIndex, availableImages, availableModels, actor, callback);
    }

    _parseAfterHD(data: VectorTile, layerIndex: StyleLayerIndex, availableImages: ImageId[], availableModels: StyleModelMap, actor: WorkerSourceActor, callback: WorkerSourceVectorTileCallback) {
        const m = PerformanceUtils.beginMeasure('parseTile1');
        this.status = 'parsing';
        this.data = data;

        // Parse FRC coverage polygons early (before normal bucket creation).
        // Coverage tiles also create normal buckets so layers like hd-coverage-helper render.
        let frcCoveragePolygons: FrcCoveragePolygons | undefined;
        if (this.renderSourceType === RenderSourceType.HdRoadCoverage) {
            const coverageLayer = data.layers[HD_ROAD_COVERAGE_SOURCE_LAYER];
            frcCoveragePolygons = coverageLayer && HD.parseFrcCoverageFromLayer ? HD.parseFrcCoverageFromLayer(coverageLayer) : [];
        }

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
            showElevationIdDebug: this.showElevationIdDebug,
            elevationFeatures: undefined,
            elevationParams: this.elevation,
            crossSourceElevationEnabled: this.crossSourceElevationEnabled,
            terrainEnabled: this.terrainEnabled,
            activeFloors: undefined,
        };

        if (this.indoor && HD.parseActiveFloors) {
            options.activeFloors = HD.parseActiveFloors(data, this.indoor, actor, this.canonical);
        }

        const asyncBucketLoads: Promise<unknown>[] = [];
        const layerFamilies = layerIndex.familiesBySource[this.source];

        // Dedicated elevation provider tiles only extract hd_road_elevation features
        // for the main-thread snapshot; they must not run the feature-source bucket path.
        if (this.renderSourceType === RenderSourceType.HdRoadElevation) {
            const parsedElevationFeatures = HD.parseElevationFeatures ?
                (HD.parseElevationFeatures(data, this.canonical) || []) :
                [];
            const glyphAtlas = new GlyphAtlas({});
            this.status = 'done';
            callback(null, {
                buckets: [],
                containsHdExt: false,
                containsStandardExt: false,
                featureIndex,
                collisionBoxArray: this.collisionBoxArray,
                glyphAtlasImage: glyphAtlas.image,
                lineAtlas,
                imageAtlas: null,
                brightness: this.brightness,
                parsedElevationFeatures,
            });
            PerformanceUtils.endMeasure(m, [["tileID", this.tileID.toString()], ["source", this.source]]);
            return;
        }

        // Defer configured coverage source layers when HD coverage hasn't resolved yet.
        // When coverage arrives, tiles are reparsed with coverageFrcMask set,
        // allowing fully covered features to be skipped at parse time.
        this.deferRoadStructure = false;
        if (this.renderSourceType !== RenderSourceType.HdRoadCoverage &&
            this.frcCoverage != null &&
            !this.frcCoverage.resolved &&
            this.frcCoverage.frcMask === null) {
            for (const sourceLayerId in layerFamilies) {
                if (HD.matchesCoverageSourceLayer && HD.matchesCoverageSourceLayer(this.frcCoverage.sourceLayers, this.source, sourceLayerId)) {
                    this.deferRoadStructure = true;
                    break;
                }
            }
        }

        for (const sourceLayerId in layerFamilies) {
            const sourceLayer = data.layers[sourceLayerId];
            if (!sourceLayer) {
                continue;
            }

            let anySymbolLayers = false;
            let anyFillExtrusionLayers = false;
            let anyOtherLayers = false;
            let any3DLayer = false;

            for (const family of layerFamilies[sourceLayerId]) {
                if (family[0].type === 'symbol') {
                    anySymbolLayers = true;
                } else if (family[0].type === 'fill-extrusion') {
                    anyFillExtrusionLayers = true;
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

            // Source-layer level filtering: skip entire source layers that have no relevant layer types
            if (this.renderSourceType === RenderSourceType.Symbol && !anySymbolLayers) {
                continue;
            } else if (this.renderSourceType === RenderSourceType.FillExtrusion && !anyFillExtrusionLayers) {
                continue;
            } else if ((this.renderSourceType === RenderSourceType.Other ||
                        this.renderSourceType === RenderSourceType.HdRoadCoverage) && !anyOtherLayers) {
                continue;
            }

            // Defer configured coverage source layers when coverage hasn't resolved.
            const isRoadOrStructureLayer = this.frcCoverage != null && !!HD.matchesCoverageSourceLayer && HD.matchesCoverageSourceLayer(this.frcCoverage.sourceLayers, this.source, sourceLayerId);
            if (this.deferRoadStructure && isRoadOrStructureLayer) {
                continue;
            }

            if (sourceLayer.version === 1) {
                warnOnce(`Vector tile source "${this.source}" layer "${sourceLayerId}" ` +
                    `does not use vector tile spec v2 and therefore may have some rendering errors.`);
            }

            const sourceLayerIndex = sourceLayerCoder.encode(sourceLayerId);
            const features: IndexedFeature[] = [];

            const localizable = this.localizableLayerIds && this.localizableLayerIds.has(sourceLayerId);

            let elevationDependency = false;
            for (let index = 0, currentFeatureIndex = 0; index < sourceLayer.length; index++) {
                const feature = sourceLayer.feature(index);
                const id = featureIndex.getId(feature, sourceLayerId);
                const worldview = feature.properties ? feature.properties.worldview : null;

                // Handle feature localization based on the map worldview:
                // 1. If the feature layer is localizable, check if it has a 'worldview' property
                // 2. Check if the feature worldview is 'all' (visible in all worldviews) or matches the current map worldview
                // 3. Mark the feature with '$localized' property or skip it otherwise
                if (localizable && this.worldview && typeof worldview === 'string') {
                    if (worldview === 'all') {
                        feature.properties['$localized'] = true;
                    } else if (worldview.split(',').includes(this.worldview)) {
                        feature.properties['$localized'] = true;
                        feature.properties['worldview'] = this.worldview;
                    } else {
                        continue; // Skip features that don't match the current worldview
                    }
                }

                if (!elevationDependency && feature.properties && Object.hasOwn(feature.properties, PROPERTY_ELEVATION_ID)) {
                    elevationDependency = true;
                }

                // Skip features fully covered by FRC mask on road/structure source layers
                if (isRoadOrStructureLayer && this.frcCoverage && this.frcCoverage.frcMask && feature.properties && HD.isFeatureCoveredByFrcMask &&
                    HD.isFeatureCoveredByFrcMask(feature.properties, this.frcCoverage.frcMask)) {
                    continue;
                }

                features.push({feature, id, index: currentFeatureIndex, sourceLayerIndex});
                currentFeatureIndex++;
            }

            if (elevationDependency && !options.elevationFeatures && HD.parseElevationFeatures) {
                options.elevationFeatures = HD.parseElevationFeatures(data, this.canonical);
            }

            for (const family of layerFamilies[sourceLayerId]) {
                const layer = family[0];

                if (this.extraShadowCaster && (!layer.is3D() || layer.type === 'model')) {
                    // avoid to spend resources in 2D layers or 3D model layers (trees) for extra shadow casters
                    continue;
                }
                // Three-way render source type filtering:
                if (this.renderSourceType === RenderSourceType.Symbol && layer.type !== 'symbol') continue;
                if (this.renderSourceType === RenderSourceType.FillExtrusion && layer.type !== 'fill-extrusion') continue;
                if ((this.renderSourceType === RenderSourceType.Other ||
                     this.renderSourceType === RenderSourceType.HdRoadCoverage) &&
                    (layer.type === 'symbol' || layer.type === 'fill-extrusion')) continue;
                assert(layer.source === this.source);
                if (!this.isLayerActiveForTile(layer)) continue;

                recalculateLayers(family, this.zoom, options.brightness, availableImages, this.worldview, options.activeFloors);

                // Assign bucket.index and register the layer-id mapping synchronously in
                // style order. The async prepare() chain below can resolve out of order
                // (HD layers add a microtask tick for the dynamic-import await), and
                // queryRenderedFeatures / hit-testing rely on bucket.index reflecting the
                // layer's position in the style.
                const bucketIndex = featureIndex.bucketLayerIDs.length;
                featureIndex.bucketLayerIDs.push(family.map((l) => makeFQID(l.id, l.scope)));

                const processBucket = () => {
                    const styleLayer: StyleLayer = layer;
                    assert(styleLayer.createBucket);
                    const bucket: Bucket = buckets[layer.id] = styleLayer.createBucket({
                        index: bucketIndex,
                        layers: family,
                        zoom: this.zoom,
                        lut: this.lut,
                        canonical: this.canonical,
                        pixelRatio: this.pixelRatio,
                        overscaling: this.overscaling,
                        collisionBoxArray: this.collisionBoxArray,
                        sourceLayerIndex,
                        sourceLayerName: sourceLayerId,
                        sourceID: this.source,
                        projection: this.projection.spec,
                        tessellationStep: this.tessellationStep,
                        styleDefinedModelURLs: availableModels,
                        worldview: this.worldview,
                        localizable,
                        availableImages,
                        maxUniformBufferBindings: this.maxUniformBufferBindings,
                        maxUniformBlockSizeDwords: this.maxUniformBlockSizeDwords
                    });

                    assert(this.tileTransform.projection.name === this.projection.name);

                    // Attach HD extension when the layer declares HD elevation OR when the
                    // bucket's source layer participates in FRC coverage. Dispatching through
                    // HD.attachExtension keeps the relevance checks and the concrete extension
                    // classes in the HD module — core stays unaware of which bucket types are
                    // HD-augmentable.
                    if (HD.attachExtension) HD.attachExtension(bucket, this.frcCoverage ? this.frcCoverage.sourceLayers : null);

                    bucket.populate(features, options, this.tileID.canonical, this.tileTransform);
                };

                // Only module-relevant layers go through the async prepare() path; everything
                // else stays fully synchronous so non-HD/Standard tiles pay no microtask overhead.
                if (layer.mayUse('HD') || layer.mayUse('Standard')) {
                    asyncBucketLoads.push(layer.prepare().then(() => processBucket()));
                } else {
                    processBucket();
                }
            }
        }

        const prepareTile = () => {
            lineAtlas.trim();
            const hasTunnelGeometry = !!(options.elevationFeatures && options.elevationFeatures.some((feature) => feature.heightRange.min < 0.0));

            let error: Error | null | undefined;
            let glyphMap: GlyphMap;
            let iconMap: StyleImageMap<StringifiedImageVariant>;
            let patternMap: StyleImageMap<StringifiedImageVariant>;
            let iconRasterizationTasks: ImageRasterizationTasks;
            let patternRasterizationTasks: ImageRasterizationTasks;
            let imageVersions: Map<string, number>;
            const taskMetadata = {type: 'maybePrepare', renderSourceType: this.renderSourceType, zoom: this.zoom} as const;

            const maybePrepare = () => {
                if (error) {
                    this.status = 'done';
                    return callback(error);
                } else if (this.extraShadowCaster) {
                    const m = PerformanceUtils.beginMeasure('parseTile2');
                    this.status = 'done';
                    const transferredBuckets = Object.values(buckets).filter(b => !b.isEmpty());
                    const elevationSidecar = options.elevationFeatures;
                    callback(null, {
                        buckets: transferredBuckets,
                        containsHdExt: anyBucketRequiresHD(transferredBuckets),
                        containsStandardExt: anyBucketRequiresStandard(transferredBuckets),
                        featureIndex,
                        collisionBoxArray: null,
                        hasTunnelGeometry,
                        glyphAtlasImage: null,
                        lineAtlas: null,
                        imageAtlas: null,
                        brightness: options.brightness,
                        hasDeferredElevationFeatures: HD.anyDeferredElevationFeatures ? HD.anyDeferredElevationFeatures(buckets) : false,
                        parsedElevationFeatures: elevationSidecar,
                        // Only used for benchmarking:
                        glyphMap: null,
                        iconMap: null,
                        glyphPositions: null
                    });
                    PerformanceUtils.endMeasure(m, [["tileID", this.tileID.toString()], ["source", this.source]]);
                } else if (glyphMap && iconMap && patternMap && imageVersions) {
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
                            recalculateLayers(bucket.layers, this.zoom, options.brightness, availableImages, this.worldview, options.activeFloors);
                            symbolLayoutData[key] = performSymbolLayout(
                                bucket,
                                glyphMap,
                                glyphAtlas.positions,
                                iconMap,
                                iconPositions,
                                this.tileID.canonical,
                                this.tileZoom,
                                this.scaleFactor,
                                this.pixelRatio,
                                iconRasterizationTasks,
                                this.worldview,
                                availableImages,
                                this.frcCoverage ? this.frcCoverage.frcMask : null,
                                this.frcCoverage ? this.frcCoverage.polygons : null,
                                this.frcCoverage ? this.frcCoverage.tileZoom : null,
                                HD.isFeatureCoveredByFrcMask || null,
                                HD.symbolAnchorInFrcCoverage || null);
                        }
                    }

                    if (iconRasterizationTasks.size || patternRasterizationTasks.size) {
                        this.rasterizeTask = actor.sendCancelable('rasterizeImages', {scope: this.scope, iconTasks: iconRasterizationTasks, patternTasks: patternRasterizationTasks}, {}, (err, rasterizedImages) => {
                            if (!err) {
                                for (const [id, data] of rasterizedImages.entries()) {
                                    if (iconMap.has(id)) iconMap.set(id, Object.assign(iconMap.get(id), {data}));
                                    if (patternMap.has(id)) patternMap.set(id, Object.assign(patternMap.get(id), {data}));
                                }
                            }
                            postRasterizationLayout(symbolLayoutData, glyphAtlas, m, imageVersions);
                        });
                    } else {
                        postRasterizationLayout(symbolLayoutData, glyphAtlas, m, imageVersions);
                    }

                }
            };

            const postRasterizationLayout = (symbolLayoutData: Record<string, SymbolBucketData>, glyphAtlas: GlyphAtlas, m: PerformanceMark, imageVersions?: Map<string, number>) => {

                // Check if we have any images - if not, skip atlas caching to avoid extra round-trips
                const hasImages = iconMap.size > 0 || patternMap.size > 0;
                const hasSymbolLayout = Object.keys(symbolLayoutData).length > 0;

                // If no images and no symbol layout, we can complete synchronously
                const elevationSidecar = options.elevationFeatures;
                if (!hasImages && !hasSymbolLayout) {
                    this.status = 'done';
                    const transferredBuckets = Object.values(buckets).filter(b => !b.isEmpty());
                    callback(null, {
                        buckets: transferredBuckets,
                        containsHdExt: anyBucketRequiresHD(transferredBuckets),
                        containsStandardExt: anyBucketRequiresStandard(transferredBuckets),
                        featureIndex,
                        collisionBoxArray: this.collisionBoxArray,
                        hasTunnelGeometry,
                        glyphAtlasImage: glyphAtlas.image,
                        lineAtlas,
                        imageAtlas: null,
                        brightness: options.brightness,
                        hasDeferredRoadStructure: this.deferRoadStructure,
                        frcCoveragePolygons,
                        hasDeferredElevationFeatures: HD.anyDeferredElevationFeatures ? HD.anyDeferredElevationFeatures(buckets) : false,
                        parsedElevationFeatures: elevationSidecar,
                    });
                    PerformanceUtils.endMeasure(m, [["tileID", this.tileID.toString()], ["source", this.source]]);
                    return;
                }

                const completeBucketProcessing = (imageAtlasForTransfer: ImageAtlas | ImageAtlasReference | null, positions: {iconPositions: ImagePositionMap; patternPositions: ImagePositionMap}) => {
                    // Process buckets using positions
                    for (const key in buckets) {
                        const bucket = buckets[key];
                        if (key in symbolLayoutData) {
                            postRasterizationSymbolLayout(bucket as SymbolBucket, symbolLayoutData[key], this.showCollisionBoxes, availableImages, this.tileID.canonical, this.tileZoom, this.projection, this.brightness, iconMap, positions);
                        } else if (bucket.hasPattern &&
                            (bucket instanceof LineBucket ||
                                bucket instanceof FillBucket ||
                                bucket instanceof FillExtrusionBucket)) {
                            recalculateLayers(bucket.layers, this.zoom, options.brightness, availableImages, this.worldview, options.activeFloors);
                            const imagePositions: SpritePositions = Object.fromEntries(positions.patternPositions);
                            bucket.addFeatures(options, this.tileID.canonical, imagePositions, availableImages, this.tileTransform, this.brightness);
                        }
                    }

                    this.status = 'done';
                    const transferredBuckets = Object.values(buckets).filter(b => !b.isEmpty());
                    callback(null, {
                        buckets: transferredBuckets,
                        containsHdExt: anyBucketRequiresHD(transferredBuckets),
                        containsStandardExt: anyBucketRequiresStandard(transferredBuckets),
                        featureIndex,
                        collisionBoxArray: this.collisionBoxArray,
                        hasTunnelGeometry,
                        glyphAtlasImage: glyphAtlas.image,
                        lineAtlas,
                        imageAtlas: imageAtlasForTransfer,
                        brightness: options.brightness,
                        hasDeferredRoadStructure: this.deferRoadStructure,
                        frcCoveragePolygons,
                        hasDeferredElevationFeatures: HD.anyDeferredElevationFeatures ? HD.anyDeferredElevationFeatures(buckets) : false,
                        parsedElevationFeatures: elevationSidecar,
                    });
                    PerformanceUtils.endMeasure(m, [["tileID", this.tileID.toString()], ["source", this.source]]);
                };

                // If we have images, do atlas caching
                if (hasImages) {
                    // Phase 1: Create descriptor and check cache on main thread BEFORE creating atlas
                    // This ensures subsequent tiles can reuse the cached atlas from the first tile
                    // Cache parsed variants to avoid re-parsing in AtlasContentDescriptor
                    const variantCache = new Map<StringifiedImageVariant, ImageVariant>();
                    const sortedIcons = sortImagesMap(iconMap, variantCache);
                    const sortedPatterns = sortImagesMap(patternMap, variantCache);
                    const descriptor = new AtlasContentDescriptor(sortedIcons, sortedPatterns, imageVersions, this.lut, variantCache);

                    actor.send('checkAtlasCache', {descriptor, scope: this.scope})
                        .then((cachedPositions) => {
                            let imageAtlasForTransfer: ImageAtlas | ImageAtlasReference;
                            let positions: {iconPositions: ImagePositionMap; patternPositions: ImagePositionMap};

                            if (cachedPositions) {
                                imageAtlasForTransfer = new ImageAtlasReference(cachedPositions.sourceHash);
                                positions = cachedPositions;
                            } else {
                                const imageAtlas = new ImageAtlas(iconMap, patternMap, this.lut, imageVersions);
                                imageAtlasForTransfer = imageAtlas;
                                positions = imageAtlas;
                            }

                            completeBucketProcessing(imageAtlasForTransfer, positions);
                        })
                        .catch((err: Error) => {
                            if (err.name !== 'AbortError') warnOnce(`[Worker] Error checking atlas cache: ${err.message}`);
                            const imageAtlas = new ImageAtlas(iconMap, patternMap, this.lut, imageVersions);
                            completeBucketProcessing(imageAtlas, imageAtlas);
                        });
                } else {
                    // No images but has symbol layout (text-only symbols) - complete synchronously
                    // Provide empty position maps for text-only symbols
                    const emptyPositions = {
                        iconPositions: new Map(),
                        patternPositions: new Map()
                    };
                    completeBucketProcessing(null, emptyPositions);
                }
            };

            if (!this.extraShadowCaster) {
                const stacks = mapObject(options.glyphDependencies, (glyphs) => Object.keys(glyphs).map(Number));
                if (Object.keys(stacks).length) {
                    actor.send('getGlyphs', {uid: this.uid, stacks}, {metadata: taskMetadata})
                        .then((result: GlyphMap) => {
                            if (!error) {
                                glyphMap = result;
                                maybePrepare();
                            }
                        })
                        .catch((err: Error) => {
                            if (!error) {
                                error = err;
                                maybePrepare();
                            }
                        });
                } else {
                    glyphMap = {};
                }

                imageVersions = new Map();

                const icons = Array.from(options.iconDependencies.keys()).map((id) => ImageId.parse(id));
                const patterns = Array.from(options.patternDependencies.keys()).map((id) => ImageId.parse(id));
                if (icons.length || patterns.length) {
                    actor.send('getImages', {icons, patterns, source: this.source, scope: this.scope, tileID: this.tileID}, {metadata: taskMetadata})
                        .then((getImagesResult) => {
                            if (error) return;
                            iconMap = new Map();
                            patternMap = new Map();
                            iconRasterizationTasks = this.updateImageMapAndGetImageTaskQueue(iconMap, getImagesResult.images, options.iconDependencies);
                            patternRasterizationTasks = this.updateImageMapAndGetImageTaskQueue(patternMap, getImagesResult.images, options.patternDependencies);
                            for (const [id, version] of getImagesResult.versions.entries()) {
                                imageVersions.set(id, version);
                            }
                            maybePrepare();
                        })
                        .catch((err: Error) => {
                            if (!error) {
                                error = err;
                                maybePrepare();
                            }
                        });
                } else {
                    iconMap = new Map();
                    patternMap = new Map();
                    iconRasterizationTasks = new Map();
                    patternRasterizationTasks = new Map();
                }
            }

            if (HD.postprocessTile) HD.postprocessTile({buckets, data, sourceLayerCoder, canonical: this.tileID.canonical, options});

            PerformanceUtils.endMeasure(m, [["tileID", this.tileID.toString()], ["source", this.source]]);

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

    updateParameters(params: WorkerSourceVectorTileRequest) {
        this.scaleFactor = params.scaleFactor;
        this.showCollisionBoxes = params.showCollisionBoxes;
        this.showElevationIdDebug = params.showElevationIdDebug;
        this.projection = params.projection;
        this.brightness = params.brightness;
        this.tileTransform = tileTransform(params.tileID.canonical, params.projection);
        this.extraShadowCaster = params.extraShadowCaster;
        this.lut = params.lut;
        this.worldview = params.worldview;
        this.indoor = params.indoor;
        this.frcCoverage = params.frcCoverage || null;
        this.elevation = params.elevation || null;
        this.terrainEnabled = !!params.terrainEnabled;
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
                    imageMap.set(imageVariantStr, {...image});
                }
            }
        }

        return imageRasterizationTasks;
    }

    cancelRasterize() {
        if (this.rasterizeTask) {
            this.rasterizeTask.abort();
        }
    }
}

function recalculateLayers(layers: ReadonlyArray<TypedStyleLayer>, zoom: number, brightness: number, availableImages: ImageId[], worldview: string | undefined, activeFloors: Set<string> | undefined) {
    // Layers are shared and may have been used by a WorkerTile with a different zoom.
    const parameters = new EvaluationParameters(zoom, {brightness, worldview, activeFloors});
    for (const layer of layers) {
        layer.recalculate(parameters, availableImages);
    }
}

export default WorkerTile;
