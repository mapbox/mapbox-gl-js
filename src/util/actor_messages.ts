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
 * Messages a {@link MapWorker} receives from the main thread.
 */
export type WorkerInbox = {
    'abortTile': {
        params: WorkerSourceTileRequest;
        result: void;
    };

    'checkIfReady': {
        params: void;
        result: void;
    };

    'clearCaches': {
        params: void;
        result: void;
    };

    'decodeRasterArray': {
        params: WorkerSourceTileRequest & {buffer: ArrayBuffer; task: TProcessingBatch};
        result: TDecodingResult[];
    };

    'enforceCacheSizeLimit': {
        params: number;
        result: void;
    };

    'geojson.getClusterChildren': {
        params: {clusterId: number; source: string; scope: string;};
        result: GeoJSON.Feature[];
    };

    'geojson.getClusterExpansionZoom': {
        params: {clusterId: number; source: string; scope: string;};
        result: number;
    };

    'geojson.getClusterLeaves': {
        params: {source: string; scope: string; clusterId: number; limit: number; offset: number;};
        result: GeoJSON.Feature[];
    };

    'geojson.loadData': {
        params: LoadGeoJSONRequest;
        result: LoadGeoJSONResult;
    };

    'loadTile': {
        params: WorkerSourceTileRequest;
        result: unknown;
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
        result: Partial<TileJSON> | null;
    };

    'reloadTile': {
        params: WorkerSourceTileRequest;
        result: unknown;
    };

    'removeSource': {
        params: WorkerSourceRequest;
        result: void;
    };

    'removeTile': {
        params: WorkerSourceTileRequest;
        result: void;
    };

    'upsertRenderParams': {
        params: RenderParameters;
        result: void;
    };

    'setGlobalParams': {
        params: GlobalParams;
        result: void;
    };

    'setImages': {
        params: {images: ImageId[]; scope: string; isSpriteLoaded?: boolean};
        result: void;
    };

    'spriteLoaded': {
        params: {scope: string;};
        result: void;
    };

    'setLayers': {
        params: {layers: LayerSpecification[]; scope: string; options: ConfigOptions};
        result: void;
    };

    'setModels': {
        params: {models: StyleModelMap; scope: string;};
        result: void;
    };

    'setProjection': {
        params: ProjectionSpecification;
        result: void;
    };

    'syncRTLPluginState': {
        params: PluginState;
        result: boolean;
    };

    'updateLayers': {
        params: {layers: LayerSpecification[]; removedIds: string[]; scope: string; options: ConfigOptions};
        result: void;
    };
};

/**
 * Messages {@link Style} receives back from a worker.
 */
export type MainInbox = {
    'getGlyphs': {
        params: {stacks: FontStacks; uid?: number};
        result: GlyphMap;
    };

    'getImages': {
        params: {icons: ImageId[]; patterns: ImageId[]; scope: string; source: string; tileID: OverscaledTileID};
        result: {images: StyleImageMap<StringifiedImageId>; versions: Map<string, number>};
    };

    'checkAtlasCache': {
        params: {descriptor: AtlasContentDescriptor; scope: string};
        result: {iconPositions: ImagePositionMap; patternPositions: ImagePositionMap; sourceHash: number} | null;
    };

    'rasterizeImages': {
        params: {scope: string; iconTasks: ImageRasterizationTasks; patternTasks: ImageRasterizationTasks};
        result: RasterizedImageMap;
    };

    'setIndoorData': {
        params: IndoorData;
        result: void;
    };
};

/**
 * The union of all messages that can be sent between the main thread and a worker.
 */
export type ActorInbox = WorkerInbox & MainInbox;

/**
 * Every message name across both directions.
 */
export type ActorMessage = keyof WorkerInbox | keyof MainInbox;
