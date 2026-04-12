import {mapboxgl} from '../lib/mapboxgl.js';
import config from '../../../src/util/config';

// We are self-hosting test files.
config.REQUIRE_ACCESS_TOKEN = false;

// Override provider module URL to use the locally-served dist bundle
mapboxgl.addTileProvider('pmtiles', `${location.origin}/packages/pmtiles-provider/dist/mapbox-gl-pmtiles-provider.js`);

mapboxgl.prewarm();
mapboxgl.setRTLTextPlugin('https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.4.0/mapbox-gl-rtl-text.js');
