import {mapboxgl} from '../lib/mapboxgl.js';
import config from '../../../src/util/config';

// We are self-hosting test files.
config.REQUIRE_ACCESS_TOKEN = false;

mapboxgl.prewarm();
mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.3.0/mapbox-gl-rtl-text.js');
