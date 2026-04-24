import {isWasmSimdSupported} from './is_wasm_simd_supported';

const API_URL_REGEX = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/|\?|$)/i;
const API_TILEJSON_REGEX = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/v[0-9]*\/.*\.json.*$)/i;
const API_SPRITE_REGEX = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/styles\/v[0-9]*\/)(.*\/sprite.*\..*$)/i;
const API_FONTS_REGEX = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/fonts\/v[0-9]*\/)(.*\.pbf.*$)/i;
const API_STYLE_REGEX = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/styles\/v[0-9]*\/)(.*$)/i;
const API_CDN_URL_REGEX = /^((https?:)?\/\/)?api\.mapbox\.c(n|om)(\/mapbox-gl-js\/)(.*$)/i;

export type Config = {
    API_URL: string;
    API_URL_REGEX: RegExp;
    API_TILEJSON_REGEX: RegExp;
    API_FONTS_REGEX: RegExp;
    API_SPRITE_REGEX: RegExp;
    API_STYLE_REGEX: RegExp;
    API_CDN_URL_REGEX: RegExp;
    EVENTS_URL: string | null | undefined;
    SESSION_PATH: string;
    FEEDBACK_URL: string;
    REQUIRE_ACCESS_TOKEN: boolean;
    TILE_URL_VERSION: string;
    RASTER_URL_PREFIX: string;
    RASTERARRAYS_URL_PREFIX: string;
    ACCESS_TOKEN: string | null | undefined;
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    DRACO_URL: string;
    MESHOPT_URL: string;
    MESHOPT_SIMD_URL: string;
    BUILDING_GEN_URL: string;
    DEFAULT_STYLE: string;
    GLYPHS_URL: string;
    TILES3D_URL_PREFIX: string;
    TILE_PROVIDER_URLS: Record<string, string>;
};

const config: Config = {
    API_URL: 'https://api.mapbox.com',
    API_URL_REGEX,
    API_TILEJSON_REGEX,
    API_SPRITE_REGEX,
    API_FONTS_REGEX,
    API_STYLE_REGEX,
    API_CDN_URL_REGEX,
    get EVENTS_URL() {
        if (!config.API_URL) { return null; }
        try {
            const url = new URL(config.API_URL);
            if (url.hostname === 'api.mapbox.cn') {
                return 'https://events.mapbox.cn/events/v2';
            } else if (url.hostname === 'api.mapbox.com') {
                return 'https://events.mapbox.com/events/v2';
            } else {
                return null;
            }
        } catch (e) {
            return null;
        }
    },
    SESSION_PATH: '/map-sessions/v1',
    FEEDBACK_URL: 'https://apps.mapbox.com/feedback',
    TILE_URL_VERSION: 'v4',
    RASTER_URL_PREFIX: 'raster/v1',
    RASTERARRAYS_URL_PREFIX: 'rasterarrays/v1',
    REQUIRE_ACCESS_TOKEN: true,
    ACCESS_TOKEN: null,
    DEFAULT_STYLE: 'mapbox://styles/mapbox/standard',
    MAX_PARALLEL_IMAGE_REQUESTS: 16,
    DRACO_URL: '/mapbox-gl-js/draco_decoder_gltf_v1.5.6.wasm',
    MESHOPT_URL: '/mapbox-gl-js/meshopt_base_v0.20.wasm',
    MESHOPT_SIMD_URL: '/mapbox-gl-js/meshopt_simd_v0.20.wasm',
    BUILDING_GEN_URL: '/mapbox-gl-js/building-gen/building_gen_v1.2.4.wasm',
    GLYPHS_URL: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    TILES3D_URL_PREFIX: '3dtiles/v1',
    TILE_PROVIDER_URLS: Object.assign(Object.create(null) as Record<string, string>, {
        pmtiles: `/mapbox-gl-js/mapbox-gl-pmtiles-provider-v0.0.1.js`,
    }),
};

// Returns the config subset that can be changed via public setters and needs syncing to workers.
export function getBroadcastableConfig() {
    return {
        API_URL: config.API_URL,
        DRACO_URL: config.DRACO_URL,
        MESHOPT_URL: config.MESHOPT_URL,
        MESHOPT_SIMD_URL: config.MESHOPT_SIMD_URL,
        BUILDING_GEN_URL: config.BUILDING_GEN_URL,
    };
}

export function getDracoUrl(): string {
    return new URL(config.DRACO_URL, config.API_URL).href;
}

export function getMeshoptUrl(): string {
    if (typeof WebAssembly !== 'object') {
        throw new Error("WebAssembly not supported, cannot instantiate meshoptimizer");
    }

    return new URL(isWasmSimdSupported() ? config.MESHOPT_SIMD_URL : config.MESHOPT_URL, config.API_URL).href;
}

export function getBuildingGenUrl(): string {
    return new URL(config.BUILDING_GEN_URL, config.API_URL).href;
}

export default config;
