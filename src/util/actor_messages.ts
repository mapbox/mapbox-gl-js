import type {ActorCallback} from './actor';
import type {ConfigOptions} from '../style-spec/types/config_options';
import type {GlyphMap, FontStacks} from '../render/glyph_manager';
import type {ImageId, StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {ImageRasterizationTasks, ImageRasterizationWorkerTasks, RasterizedImageMap} from '../render/image_manager';
import type {LayerSpecification, ProjectionSpecification} from '../style-spec/types';
import type {LoadGeoJSONRequest} from '../source/geojson_source';
import type {LoadGeoJSONResult} from '../source/geojson_worker_source';
import type {OverscaledTileID} from '../source/tile_id';
import type {PluginState} from '../source/rtl_text_plugin';
import type {RequestParameters} from './ajax';
import type {StyleImageMap} from '../style/style_image';
import type {TDecodingResult, TProcessingBatch} from '../data/mrt/types';
import type {WorkerPerformanceMetrics} from './performance';
import type {WorkerSourceRequest, WorkerSourceTileRequest} from '../source/worker_source';
import type {StyleModelMap} from '../style/style_mode';

/**
 * Message registry maps message types to their data and result types.
 */
export type ActorMessages = {
    'abortTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<void>;
    };

    'checkIfReady': {
        params: void;
        callback: ActorCallback<void>;
    };

    'clearCaches': {
        params: void;
        callback: ActorCallback<void>;
    };

    'decodeRasterArray': {
        params: WorkerSourceTileRequest & {buffer: ArrayBuffer; task: TProcessingBatch};
        callback: ActorCallback<TDecodingResult[]>;
    };

    'enforceCacheSizeLimit': {
        params: number;
        callback: void;
    };

    'geojson.getClusterChildren': {
        params: {clusterId: number; source: string; scope: string;};
        callback: ActorCallback<GeoJSON.Feature[]>;
    };

    'geojson.getClusterExpansionZoom': {
        params: {clusterId: number; source: string; scope: string;};
        callback: ActorCallback<number>;
    };

    'geojson.getClusterLeaves': {
        params: {source: string; scope: string; clusterId: number; limit: number; offset: number;};
        callback: ActorCallback<GeoJSON.Feature[]>;
    };

    'geojson.loadData': {
        params: LoadGeoJSONRequest;
        callback: ActorCallback<LoadGeoJSONResult>;
    };

    'getGlyphs': {
        params: {stacks: FontStacks; uid?: number};
        callback: ActorCallback<GlyphMap>;
    };

    'getImages': {
        params: {images: ImageId[]; scope: string; source: string; tileID: OverscaledTileID; type: 'icons' | 'patterns'};
        callback: ActorCallback<StyleImageMap<StringifiedImageId>>;
    };

    'getResource': {
        params: RequestParameters;
        callback: ActorCallback<unknown>;
    };

    'getWorkerPerformanceMetrics': {
        params: void;
        callback: ActorCallback<WorkerPerformanceMetrics>;
    };

    'loadTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<unknown>;
    };

    'loadWorkerSource': {
        params: {name: string; url: string;};
        callback: ActorCallback<void>;
    };

    'rasterizeImages': {
        params: {scope: string; tasks: ImageRasterizationTasks};
        callback: ActorCallback<RasterizedImageMap>;
    };

    'rasterizeImagesWorker': {
        params: {scope: string; tasks: ImageRasterizationWorkerTasks};
        callback: ActorCallback<RasterizedImageMap>;
    };

    'reloadTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<unknown>;
    };

    'removeRasterizedImages': {
        params: {scope: string; imageIds: ImageId[]};
        callback: ActorCallback<void>;
    };

    'removeSource': {
        params: WorkerSourceRequest;
        callback: ActorCallback<void>;
    };

    'removeTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<void>;
    };

    'setBrightness': {
        params: number;
        callback: ActorCallback<void>;
    };

    'setWorldview': {
        params: string;
        callback: ActorCallback<void>;
    };

    'setDracoUrl': {
        params: string;
        callback: ActorCallback<void>;
    };

    'setImages': {
        params: {images: ImageId[]; scope: string;};
        callback: ActorCallback<void>;
    };

    'setLayers': {
        params: {layers: LayerSpecification[]; scope: string; options: ConfigOptions};
        callback: ActorCallback<void>;
    };

    'setModels': {
        params: {models: StyleModelMap; scope: string;};
        callback: ActorCallback<void>;
    };

    'setMeshoptUrl': {
        params: string;
        callback: ActorCallback<void>;
    };

    'setProjection': {
        params: ProjectionSpecification;
        callback: void;
    };

    'setReferrer': {
        params: string;
        callback: void;
    };

    'spriteLoaded': {
        params: {scope: string; isLoaded: boolean};
        callback: void;
    };

    'syncRTLPluginState': {
        params: PluginState;
        callback: ActorCallback<boolean>;
    };

    'updateLayers': {
        params: {layers: LayerSpecification[]; removedIds: string[]; scope: string; options: ConfigOptions};
        callback: ActorCallback<void>;
    };
};

export type ActorMessage = keyof ActorMessages;
