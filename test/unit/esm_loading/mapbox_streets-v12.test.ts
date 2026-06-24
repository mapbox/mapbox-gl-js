// Hits the real Mapbox Streets v12 style to verify it loads neither HD nor Standard.
// Guards against regressions where a layer type added to Streets v12 accidentally
// triggers a module load. Uses the localhost-scoped CI token; the test will fail
// if the token is invalid or the API is unreachable.
import {test, expect, vi, waitFor} from '../../util/vitest';
import {Map, setAccessToken} from '../../../src/index.esm';
import {LOCALHOST_CI_TOKEN} from '../../util/access_token.js';
import {HD} from '../../../modules/hd_main_esm';
import {Standard} from '../../../modules/standard_main_esm';
import {makeContainer, settle} from './helpers';

test('mapbox streets-v12 style loads neither HD nor Standard', {timeout: 30000}, async () => {
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
    } finally {
        map.remove();
    }
});
