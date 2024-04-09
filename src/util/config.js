// @flow strict

type Config = {|
  API_URL: string,
  API_URL_REGEX: RegExp,
  API_TILEJSON_REGEX: RegExp,
  API_FONTS_REGEX: RegExp,
  API_SPRITE_REGEX: RegExp,
  API_STYLE_REGEX: RegExp,
  API_CDN_URL_REGEX: RegExp,
  EVENTS_URL: ?string,
  SESSION_PATH: string,
  FEEDBACK_URL: string,
  REQUIRE_ACCESS_TOKEN: boolean,
  TILE_URL_VERSION: string,
  RASTER_URL_PREFIX: string,
  RASTERARRAYS_URL_PREFIX: string,
  ACCESS_TOKEN: ?string,
  MAX_PARALLEL_IMAGE_REQUESTS: number,
  DRACO_URL: string,
  MESHOPT_URL: string,
  MESHOPT_SIMD_URL: string,
  DEFAULT_STYLE: string,
  GLYPHS_URL: string,
|};

let mapboxHTTPURLRegex;

const config: Config = {
    API_URL: 'https://api.mapbox.com',
    get API_URL_REGEX () {
        if (mapboxHTTPURLRegex == null) {
            const prodMapboxHTTPURLRegex = /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/|\?|$)/i;
            try {
                mapboxHTTPURLRegex = (process.env.API_URL_REGEX != null) ? new RegExp(process.env.API_URL_REGEX) : prodMapboxHTTPURLRegex;
            } catch (e) {
                mapboxHTTPURLRegex = prodMapboxHTTPURLRegex;
            }
        }

        return mapboxHTTPURLRegex;
    },
    get API_TILEJSON_REGEX() {
        // https://docs.mapbox.com/api/maps/mapbox-tiling-service/#retrieve-tilejson-metadata
        return /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/v[0-9]*\/.*\.json.*$)/i;
    },
    get API_SPRITE_REGEX() {
        // https://docs.mapbox.com/api/maps/styles/#retrieve-a-sprite-image-or-json
        return /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/styles\/v[0-9]*\/)(.*\/sprite.*\..*$)/i;
    },
    get API_FONTS_REGEX() {
        // https://docs.mapbox.com/api/maps/fonts/#retrieve-font-glyph-ranges
        return /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/fonts\/v[0-9]*\/)(.*\.pbf.*$)/i;
    },
    get API_STYLE_REGEX() {
        // https://docs.mapbox.com/api/maps/styles/#retrieve-a-style
        return /^((https?:)?\/\/)?([^\/]+\.)?mapbox\.c(n|om)(\/styles\/v[0-9]*\/)(.*$)/i;
    },
    get API_CDN_URL_REGEX() {
        return /^((https?:)?\/\/)?api\.mapbox\.c(n|om)(\/mapbox-gl-js\/)(.*$)/i;
    },
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
    DRACO_URL: 'https://api.mapbox.com/mapbox-gl-js/draco_decoder_gltf_v1.5.6.wasm',
    MESHOPT_URL: 'https://api.mapbox.com/mapbox-gl-js/meshopt_base_v0.20.wasm',
    MESHOPT_SIMD_URL: 'https://api.mapbox.com/mapbox-gl-js/meshopt_simd_v0.20.wasm',
    GLYPHS_URL: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf'
};

export default config;
