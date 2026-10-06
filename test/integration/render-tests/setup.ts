import {mapboxgl} from '../lib/mapboxgl.js';
import config from '../../../src/util/config';

// We are self-hosting test files.
config.REQUIRE_ACCESS_TOKEN = false;
config.RTL_TEXT_URL = `${location.origin}/mapbox-gl-rtl-text/mapbox-gl-rtl-text.wasm`;

mapboxgl.prewarm();
