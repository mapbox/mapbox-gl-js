// Hits the real Mapbox Streets v12 style to verify correct module loading behaviour.
// Uses the localhost-scoped CI token; the test will fail if the token is invalid
// or the API is unreachable.
//
// At zoom 10 (mercator) no module should load: streets-v12 has no model layers
// (Standard) and no terrain/globe (Lite).
//
// At zoom 1 the transform is in globe mode (zoom < GLOBE_ZOOM_THRESHOLD_MAX = 6),
// which triggers prepareLiteMain() for deferred draping. Lite IS expected to load
// (globeRaster/terrainRaster shaders live there). HD and Standard must stay unloaded.
import {test, expect, vi, waitFor} from '../../util/vitest';
import {Map, setAccessToken} from '../../../src/index.esm';
import {LOCALHOST_CI_TOKEN} from '../../util/access_token.js';
import {HD} from '../../../modules/hd_main_esm';
import {Standard} from '../../../modules/standard_main_esm';
import {Lite} from '../../../modules/lite_main_esm';
import {makeContainer, settle} from './helpers';

test('mapbox streets-v12 style (zoomed in / mercator) does not load HD, Standard, or Lite', {timeout: 30000}, async () => {
    setAccessToken(LOCALHOST_CI_TOKEN);
    vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    const map = new Map({
        testMode: true,
        container: makeContainer(),
        zoom: 10,   // > GLOBE_ZOOM_THRESHOLD_MAX (6) → mercator rendering
        center: [0, 0],
        interactive: false,
        attributionControl: false,
        performanceMetricsCollection: false,
        precompilePrograms: false,
        style: 'mapbox://styles/mapbox/streets-v12',
    });
    try {
        await waitFor(map, 'idle');
        await settle();
        expect(HD.loaded).toBeUndefined();
        expect(Standard.loaded).toBeUndefined();
        expect(Lite.loaded).toBeUndefined();
    } finally {
        map.remove();
    }
});

test('mapbox streets-v12 style (zoomed out / globe) loads Lite but not HD or Standard', {timeout: 30000}, async () => {
    setAccessToken(LOCALHOST_CI_TOKEN);
    vi.spyOn(Map.prototype, '_detectMissingCSS').mockImplementation(() => {});
    const map = new Map({
        testMode: true,
        container: makeContainer(),
        zoom: 1,
        center: [0, 0],
        interactive: false,
        attributionControl: false,
        performanceMetricsCollection: false,
        precompilePrograms: false,
        style: 'mapbox://styles/mapbox/streets-v12',
    });
    try {
        await waitFor(map, 'idle');
        await settle();
        expect(HD.loaded).toBeUndefined();
        expect(Standard.loaded).toBeUndefined();
        expect(Lite.loaded).toBe(true);
    } finally {
        map.remove();
    }
});
