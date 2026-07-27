import Actor from '../util/actor';
import StyleLayerIndex from '../style/style_layer_index';
import VectorTileWorkerSource from './vector_tile_worker_source';
import RasterDEMTileWorkerSource from './raster_dem_tile_worker_source';
import GeoJSONWorkerSource from './geojson_worker_source';
import * as Standard from '../../modules/standard_worker';
import * as RasterArrayWorker from '../../modules/raster_array_worker';
import assert from '../style-spec/util/assert';
import {plugin as globalRTLTextPlugin, rtlPluginStatus} from './rtl_text_plugin';
import {enforceCacheSizeLimit} from '../util/tile_request_cache';
// `LRUCache` is used eagerly on the main thread but only lazily on the worker (via the MRT
// decoder), which puts it in its own tiny chunk. Referencing it from the worker entry folds
// it into the shared chunk both entries already load.
import '../util/lru';
import {PerformanceUtils} from '../util/performance';
import {Event} from '../util/evented';
import {getProjection} from '../geo/projection/index';
import {isWorker} from '../util/util';
import config from '../util/config';
import {loadTileProvider} from './tile_provider';

import type Projection from '../geo/projection/projection';
import type {ImageId} from '../style-spec/expression/types/image_id';
import type {RtlTextPlugin} from './rtl_text_plugin';
import type {MainInbox, WorkerInbox} from '../util/actor_messages';
import type RasterArrayTileWorkerSource from './raster_array_tile_worker_source';
import type {WorkerSourceType, WorkerSource, WorkerSourceConstructor, WorkerSourceRequest} from './worker_source';
import type {TileProvider} from './tile_provider';
import type {StyleModelMap} from '../style/style_mode';

/**
 * Generic type for grouping items by mapId and style scope.
 */
type WorkerScopeRegistry<T> = Record<string, Record<string, T>>;

/**
 * WorkerSources grouped by mapId, style scope, sourceType, and sourceId.
 */
type WorkerSourceRegistry = WorkerScopeRegistry<Record<string, Record<string, WorkerSource>>>;

type RTLParsingListener = {
    resolve: (value: boolean) => void;
    reject: (err: Error) => void;
};

/**
 * @private
 */
export default class MapWorker {
    self: Worker;
    actor: Actor<MainInbox>;
    layerIndexes: WorkerScopeRegistry<StyleLayerIndex>;
    availableImages: WorkerScopeRegistry<ImageId[]>;
    availableModels: WorkerScopeRegistry<StyleModelMap>;
    workerSourceTypes: Partial<Record<WorkerSourceType, WorkerSourceConstructor>>;
    workerSources: WorkerSourceRegistry;
    projections: Record<string, Projection>;
    defaultProjection: Projection;
    isSpriteLoaded: WorkerScopeRegistry<boolean>;
    referrer: string | null | undefined;
    brightness: number | null | undefined;
    maxUniformBufferBindings: number | null | undefined;
    maxUniformBlockSizeDwords: number | null | undefined;
    worldview: string | undefined;
    rtlPluginParsingListeners: Array<RTLParsingListener>;

    constructor(self: Worker) {
        PerformanceUtils.measure('workerEvaluateScript');
        this.self = self;
        this.actor = new Actor<MainInbox>(self, this);

        this.layerIndexes = {};
        this.availableImages = {};
        this.availableModels = {};
        this.isSpriteLoaded = {};
        this.rtlPluginParsingListeners = [];

        this.projections = {};
        this.defaultProjection = getProjection({name: 'mercator'});

        this.workerSourceTypes = {
            'vector': VectorTileWorkerSource,
            'geojson': GeoJSONWorkerSource,
            'raster-dem': RasterDEMTileWorkerSource,
            // 'raster-array' and 'batched-model' are registered lazily on first `loadTile`
            // (see below): the raster-array worker source drags in the MRT decoder, and the
            // 'batched-model' worker source lives in the Standard module.
        };

        // [mapId][scope][sourceType][sourceName] => worker source instance
        this.workerSources = {};

        // The RTL text plugin self-registers here during module eval.
        this.self.registerRTLTextPlugin = (rtlTextPlugin: RtlTextPlugin) => {
            if (globalRTLTextPlugin.isParsed()) {
                throw new Error('RTL text plugin already registered.');
            }
            globalRTLTextPlugin.setState({
                pluginStatus: rtlPluginStatus.parsed,
                pluginURL: globalRTLTextPlugin.getPluginURL()
            });
            globalRTLTextPlugin['applyArabicShaping'] = rtlTextPlugin.applyArabicShaping;
            globalRTLTextPlugin['processBidirectionalText'] = rtlTextPlugin.processBidirectionalText;
            globalRTLTextPlugin['processStyledBidirectionalText'] = rtlTextPlugin.processStyledBidirectionalText;

            for (const {resolve} of this.rtlPluginParsingListeners) {
                resolve(true);
            }
            this.rtlPluginParsingListeners = [];
        };
    }

    clearCaches(mapId: number, _params: WorkerInbox['clearCaches']['params']) {
        delete this.layerIndexes[mapId];
        delete this.availableImages[mapId];
        delete this.availableModels[mapId];
        delete this.workerSources[mapId];
        delete this.isSpriteLoaded[mapId];
    }

    checkIfReady(_mapId: number, _params: WorkerInbox['checkIfReady']['params']) {
        // noop, used to check if a worker is fully set up and ready to receive messages
    }

    spriteLoaded(mapId: number, params: WorkerInbox['spriteLoaded']['params']) {
        const {scope} = params;
        if (!this.isSpriteLoaded[mapId])
            this.isSpriteLoaded[mapId] = {};

        this.isSpriteLoaded[mapId][scope] = true;

        if (!this.workerSources[mapId] || !this.workerSources[mapId][scope]) {
            return;
        }

        for (const workerSource in this.workerSources[mapId][scope]) {
            const ws = this.workerSources[mapId][scope][workerSource];
            for (const source in ws) {
                const workerSource = ws[source];
                if (workerSource instanceof VectorTileWorkerSource) {
                    workerSource.isSpriteLoaded = true;
                    workerSource.fire(new Event('isSpriteLoaded'));
                }
            }
        }
    }

    setImages(mapId: number, params: WorkerInbox['setImages']['params']) {
        if (!this.availableImages[mapId]) {
            this.availableImages[mapId] = {};
        }

        const {scope, images} = params;
        this.availableImages[mapId][scope] = images;

        if (params.isSpriteLoaded) {
            this.spriteLoaded(mapId, {scope});
        }

        if (!this.workerSources[mapId] || !this.workerSources[mapId][scope]) {
            return;
        }

        for (const workerSource in this.workerSources[mapId][scope]) {
            const ws = this.workerSources[mapId][scope][workerSource];
            for (const source in ws) {
                ws[source].availableImages = images;
            }
        }
    }

    setModels(mapId: number, {scope, models}: WorkerInbox['setModels']['params']) {
        if (!this.availableModels[mapId]) {
            this.availableModels[mapId] = {};
        }

        this.availableModels[mapId][scope] = models;

        if (!this.workerSources[mapId] || !this.workerSources[mapId][scope]) {
            return;
        }

        for (const workerSource in this.workerSources[mapId][scope]) {
            const ws = this.workerSources[mapId][scope][workerSource];
            for (const source in ws) {
                ws[source].availableModels = models;
            }
        }
    }

    setProjection(mapId: number, config: WorkerInbox['setProjection']['params']) {
        this.projections[mapId] = getProjection(config);
    }

    setGlobalParams(mapId: number, params: WorkerInbox['setGlobalParams']['params']) {
        this.referrer = params.referrer;
        Object.assign(config, params.config);

        if (params.contextOptions) {
            const {maxBindingPoints, maxUniformBlockSizeDwords} = params.contextOptions;
            this.maxUniformBufferBindings = maxBindingPoints;
            this.maxUniformBlockSizeDwords = maxUniformBlockSizeDwords;
        }
    }

    upsertRenderParams(mapId: number, params: WorkerInbox['upsertRenderParams']['params']) {
        if (params.brightness !== undefined) {
            this.brightness = params.brightness;
        }
        if (params.worldview !== undefined) {
            this.worldview = params.worldview;
        }
    }

    setLayers(mapId: number, params: WorkerInbox['setLayers']['params']) {
        this.getLayerIndex(mapId, params.scope).replace(params.layers, params.options);
    }

    updateLayers(mapId: number, params: WorkerInbox['updateLayers']['params']) {
        this.getLayerIndex(mapId, params.scope).update(params.layers, params.removedIds, params.options);
    }

    async loadTile(mapId: number, params: WorkerInbox['loadTile']['params']): Promise<WorkerInbox['loadTile']['result']> {
        assert(params.type);
        params.projection = this.projections[mapId] || this.defaultProjection;
        // The `batched-model` worker source lives in the lazily-loaded Standard module; make
        // sure it's registered before the first tile of such a source is parsed. `loadTile`
        // is already async, so an await-gate here mirrors the main-thread `worker_tile` gate.
        if (params.type === 'batched-model' && !this.workerSourceTypes['batched-model']) {
            await Standard.prepareStandard();
            if (!Standard.Tiled3dModelWorkerSource) {
                throw new Error('Could not load Standard module for "batched-model" source.');
            }
            this.workerSourceTypes['batched-model'] = Standard.Tiled3dModelWorkerSource;
        }
        if (params.type === 'raster-array') {
            await this.ensureRasterArrayWorkerSource();
        }
        return this.getWorkerSource(mapId, params).loadTile(params);
    }

    // Preload gate broadcast by the main-thread `RasterArrayTileSource` before any band fetch
    // (see `ensureRasterArraySource` in actor_messages for why it must precede `decodeRasterArray`).
    async ensureRasterArraySource(_mapId: number, _params: WorkerInbox['ensureRasterArraySource']['params']): Promise<void> {
        await this.ensureRasterArrayWorkerSource();
    }

    // Loads the raster-array worker source (and, transitively, the MRT decoder) on demand,
    // keeping it out of the always-loaded worker bundle. Idempotent and safe to call
    // concurrently — `import()` is module-cached.
    async ensureRasterArrayWorkerSource(): Promise<void> {
        if (this.workerSourceTypes['raster-array']) return;
        await RasterArrayWorker.prepareRasterArray();
        if (!RasterArrayWorker.RasterArrayTileWorkerSource) {
            throw new Error('Could not load raster-array module for "raster-array" source.');
        }
        this.workerSourceTypes['raster-array'] = RasterArrayWorker.RasterArrayTileWorkerSource;
    }

    async decodeRasterArray(mapId: number, params: WorkerInbox['decodeRasterArray']['params']): Promise<WorkerInbox['decodeRasterArray']['result']> {
        await this.ensureRasterArrayWorkerSource();
        return (this.getWorkerSource(mapId, params) as RasterArrayTileWorkerSource).decodeRasterArray(params);
    }

    reloadTile(mapId: number, params: WorkerInbox['reloadTile']['params']): Promise<WorkerInbox['reloadTile']['result']> {
        assert(params.type);
        // No lazy gate needed for 'batched-model': a reload implies the tile was previously
        // loaded in this worker's lifetime, so the Standard module is already registered.
        params.projection = this.projections[mapId] || this.defaultProjection;
        return this.getWorkerSource(mapId, params).reloadTile(params);
    }

    abortTile(mapId: number, params: WorkerInbox['abortTile']['params']): Promise<void> | void {
        assert(params.type);
        // Look up an existing worker source rather than creating one: a source whose
        // type is registered lazily (e.g. 'batched-model' from the Standard module) may
        // not exist yet when a tile is aborted before its `loadTile` runs. No instance
        // means no in-flight tile to abort.
        const workerSource = this.getExistingWorkerSource(mapId, params);
        return workerSource ? workerSource.abortTile(params) : undefined;
    }

    removeTile(mapId: number, params: WorkerInbox['removeTile']['params']): Promise<void> | void {
        assert(params.type);
        // As with `abortTile`, only act on an already-created worker source.
        const workerSource = this.getExistingWorkerSource(mapId, params);
        return workerSource ? workerSource.removeTile(params) : undefined;
    }

    getExistingWorkerSource(mapId: number, params: WorkerSourceRequest): WorkerSource | undefined {
        const {type, source, scope} = params;
        const forMap = this.workerSources[mapId];
        if (!forMap || !forMap[scope] || !forMap[scope][type]) return undefined;
        return forMap[scope][type][source];
    }

    async removeSource(mapId: number, params: WorkerInbox['removeSource']['params']): Promise<void> {
        const {type, source, scope} = params;
        assert(type);
        // The root style's scope is the empty string, so only `undefined` is a bad value.
        assert(scope !== undefined);
        assert(source);

        const forType = this.workerSources[mapId] && this.workerSources[mapId][scope] && this.workerSources[mapId][scope][type];
        // Source types with no worker implementation ('raster', 'image', 'custom', …) have no entry.
        const workerSource = forType && forType[source];
        if (!workerSource) return;

        delete forType[source];

        if (workerSource.removeSource) {
            await workerSource.removeSource({source});
        }
    }

    /**
     * Imports a tile provider module, creates an instance,
     * pre-creates the WorkerSource, and optionally loads TileJSON.
     * Called via broadcast from the main thread.
     * @private
     */
    async loadTileProvider(mapId: number, params: WorkerInbox['loadTileProvider']['params']): Promise<WorkerInbox['loadTileProvider']['result']> {
        const ProviderClass = await loadTileProvider(params.name, params.url);
        const tileProvider = new ProviderClass(params.options);

        this.getWorkerSource(mapId, {
            type: params.type,
            source: params.source,
            scope: params.scope,
        }, tileProvider);

        if (tileProvider.load && params.request) {
            return tileProvider.load({request: params.request});
        }

        return null;
    }

    async syncRTLPluginState(_mapId: number, state: WorkerInbox['syncRTLPluginState']['params']): Promise<WorkerInbox['syncRTLPluginState']['result']> {
        if (globalRTLTextPlugin.isParsed()) {
            return true;
        }
        if (globalRTLTextPlugin.isParsing()) {
            return new Promise((resolve, reject) => {
                this.rtlPluginParsingListeners.push({resolve, reject});
            });
        }

        globalRTLTextPlugin.setState(state);
        const pluginURL = globalRTLTextPlugin.getPluginURL();
        if (!globalRTLTextPlugin.isLoaded() || globalRTLTextPlugin.isParsed() || globalRTLTextPlugin.isParsing()) {
            return false;
        }

        globalRTLTextPlugin.setState({pluginStatus: rtlPluginStatus.parsing, pluginURL});
        try {
            await import(/* webpackIgnore: true */ /* @vite-ignore */ pluginURL);
            if (globalRTLTextPlugin.isParsed()) {
                // registerRTLTextPlugin (the only path to `parsed`) already resolved
                // and cleared the waiting listeners during import eval.
                return true;
            }
            return new Promise<boolean>((resolve, reject) => {
                this.rtlPluginParsingListeners.push({resolve, reject});
            });
        } catch (e: unknown) {
            globalRTLTextPlugin.setState({pluginStatus: rtlPluginStatus.error, pluginURL});
            for (const {reject} of this.rtlPluginParsingListeners) reject(e as Error);
            this.rtlPluginParsingListeners = [];
            throw e;
        }
    }

    getAvailableImages(mapId: number, scope: string): ImageId[] {
        if (!this.availableImages[mapId]) {
            this.availableImages[mapId] = {};
        }

        let availableImages = this.availableImages[mapId][scope];

        if (!availableImages) {
            availableImages = [];
        }

        return availableImages;
    }

    getAvailableModels(mapId: number, scope: string): StyleModelMap {
        if (!this.availableModels[mapId]) {
            this.availableModels[mapId] = {};
        }

        let availableModels = this.availableModels[mapId][scope];

        if (!availableModels) {
            availableModels = {};
        }

        return availableModels;
    }

    getLayerIndex(mapId: number, scope: string): StyleLayerIndex {
        if (!this.layerIndexes[mapId]) {
            this.layerIndexes[mapId] = {};
        }

        let layerIndex = this.layerIndexes[mapId][scope];

        if (!layerIndex) {
            layerIndex = this.layerIndexes[mapId][scope] = new StyleLayerIndex();
            layerIndex.scope = scope;
        }

        return layerIndex;
    }

    getWorkerSource(mapId: number, params: WorkerSourceRequest, tileProvider?: TileProvider<ArrayBuffer | ImageBitmap>): WorkerSource {
        const {type, source, scope} = params;
        const workerSources = this.workerSources;

        if (!workerSources[mapId])
            workerSources[mapId] = {};
        if (!workerSources[mapId][scope])
            workerSources[mapId][scope] = {};
        if (!workerSources[mapId][scope][type])
            workerSources[mapId][scope][type] = {};

        if (!this.isSpriteLoaded[mapId])
            this.isSpriteLoaded[mapId] = {};

        if (!this.getExistingWorkerSource(mapId, params)) {
            // One worker actor serves many maps; bind the owning mapId so the
            // WorkerSource's replies route back to the right map.
            const actor = this.actor.getWorkerSourceActor(mapId);

            const WorkerSourceConstructor = this.workerSourceTypes[type];
            if (!WorkerSourceConstructor) {
                throw new Error(`Unknown worker source type "${type}".`);
            }

            workerSources[mapId][scope][type][source] = new WorkerSourceConstructor({
                actor,
                layerIndex: this.getLayerIndex(mapId, scope),
                availableImages: this.getAvailableImages(mapId, scope),
                availableModels: this.getAvailableModels(mapId, scope),
                isSpriteLoaded: this.isSpriteLoaded[mapId][scope],
                tileProvider,
                brightness: this.brightness,
                worldview: this.worldview,
                maxUniformBufferBindings: this.maxUniformBufferBindings,
                maxUniformBlockSizeDwords: this.maxUniformBlockSizeDwords,
            });
        } else if (tileProvider) {
            // Reload (e.g. setUrl/setTiles) re-broadcasts loadTileProvider with
            // a fresh provider instance; update the existing worker source so it
            // doesn't keep using the stale provider with stale options.
            workerSources[mapId][scope][type][source].tileProvider = tileProvider;
        }

        return workerSources[mapId][scope][type][source];
    }

    enforceCacheSizeLimit(_mapId: number, limit: WorkerInbox['enforceCacheSizeLimit']['params']) {
        enforceCacheSizeLimit(limit);
    }

}

if (isWorker(self)) {
    self.worker = new MapWorker(self);
}
