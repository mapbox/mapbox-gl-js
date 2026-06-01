import type {ActorCallback} from './actor';
import type {ConfigOptions} from '../style-spec/types/config_options';
import type {GlyphMap, FontStacks} from '../render/glyph_manager';
import type {ImageId, StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {ImageRasterizationTasks, RasterizedImageMap} from '../render/image_manager';
import type {LayerSpecification, ProjectionSpecification, SourceSpecification} from '../style-spec/types';
import type {LoadGeoJSONRequest} from '../source/geojson_source';
import type {LoadGeoJSONResult} from '../source/geojson_worker_source';
import type {OverscaledTileID} from '../source/tile_id';
import type {PluginState} from '../source/rtl_text_plugin';
import type {StyleImageMap} from '../style/style_image';
import type {TDecodingResult, TProcessingBatch} from '../data/mrt/types';
import type {WorkerSourceRequest, WorkerSourceTileRequest} from '../source/worker_source';
import type {StyleModelMap} from '../style/style_mode';
import type {IndoorData} from '../style/indoor_data';
import type {AtlasContentDescriptor} from '../render/atlas_content_descriptor';
import type {ImagePositionMap} from '../render/image_atlas';
import type {TileJSON} from '../types/tilejson';
import type {RequestParameters} from './ajax';

type RenderParameters = {
    brightness?: number;
    worldview?: string;
};

type GlobalParams = {
    referrer?: string;
    config: {
        API_URL?: string;
        DRACO_URL?: string;
        MESHOPT_URL?: string;
        MESHOPT_SIMD_URL?: string;
        BUILDING_GEN_URL?: string;
    },
    contextOptions?: {
        maxBindingPoints: number;
        maxUniformBlockSizeDwords: number;
    }
};

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
        params: {icons: ImageId[]; patterns: ImageId[]; scope: string; source: string; tileID: OverscaledTileID};
        callback: ActorCallback<{images: StyleImageMap<StringifiedImageId>; versions: Map<string, number>}>;
    };

    'checkAtlasCache': {
        params: {descriptor: AtlasContentDescriptor; scope: string};
        callback: ActorCallback<{iconPositions: ImagePositionMap; patternPositions: ImagePositionMap; sourceHash: number} | null>;
    };

    'loadTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<unknown>;
    };

    'rasterizeImages': {
        params: {scope: string; iconTasks: ImageRasterizationTasks; patternTasks: ImageRasterizationTasks};
        callback: ActorCallback<RasterizedImageMap>;
    };

    'loadTileProvider': {
        params: {
            name: string;
            url: string;
            source: string;
            scope: string;
            type: string;
            options: Partial<SourceSpecification>;
            request?: RequestParameters;
        };
        callback: ActorCallback<Partial<TileJSON> | null>;
    };

    'reloadTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<unknown>;
    };

    'removeSource': {
        params: WorkerSourceRequest;
        callback: ActorCallback<void>;
    };

    'removeTile': {
        params: WorkerSourceTileRequest;
        callback: ActorCallback<void>;
    };

    'upsertRenderParams': {
        params: RenderParameters;
        callback: ActorCallback<void>;
    };

    'setGlobalParams': {
        params: GlobalParams;
        callback: ActorCallback<void>;
    };

    'setImages': {
        params: {images: ImageId[]; scope: string; isSpriteLoaded?: boolean};
        callback: ActorCallback<void>;
    };

    'spriteLoaded': {
        params: {scope: string;};
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

    'setProjection': {
        params: ProjectionSpecification;
        callback: void;
    };

    'setIndoorData': {
        params: IndoorData;
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
