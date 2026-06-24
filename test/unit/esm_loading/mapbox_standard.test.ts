// Hits the real Mapbox Standard style to verify it loads Standard (which includes
// model layers) but does not trigger HD. Guards against HD being accidentally
// pulled in by Standard. Uses the localhost-scoped CI token; the test will fail
// if the token is invalid or the API is unreachable.
import {test, expect, vi, waitFor} from '../../util/vitest';
import {Map, setAccessToken} from '../../../src/index.esm';
import {LOCALHOST_CI_TOKEN} from '../../util/access_token.js';
import {HD} from '../../../modules/hd_main_esm';
import {Standard} from '../../../modules/standard_main_esm';
import {makeContainer, settle, waitForLoaded} from './helpers';

test('mapbox standard style loads Standard but not HD', {timeout: 30000}, async () => {
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
        style: 'mapbox://styles/mapbox/standard',
    });
    try {
        await waitFor(map, 'idle');
        await waitForLoaded(Standard);
        await settle();
        expect(Standard.loaded).toBe(true);
        expect(HD.loaded).toBeUndefined();
    } finally {
        map.remove();
    }
});
