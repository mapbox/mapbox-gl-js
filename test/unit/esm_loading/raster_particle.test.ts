// This is the primary regression test for the raster-particle bug: RasterParticleStyleLayer
// was missing mayUse('HD'), so setupHD() was never triggered from renderLayer.
// raster-particle bypasses the coords guard in renderLayer, so renderLayer fires even with
// no tile data. A non-empty tiles URL is still required to pass style validation; tile loads
// are mocked to 404 so no real network traffic occurs.
import {test, expect} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import {HD} from '../../../modules/hd_main_esm';
import {Standard} from '../../../modules/standard_main_esm';
import {makeMap, waitForLoaded} from './helpers';

test('raster-particle layer triggers HD loading', async () => {
    mockFetch({'.*': () => Promise.resolve(new Response(null, {status: 404}))});
    const map = makeMap(
        [{id: 'rp', type: 'raster-particle', source: 'wind', 'source-layer': 'u_component_of_wind', paint: {}}],
        {wind: {type: 'raster-array', tiles: ['https://example.com/{z}/{x}/{y}.mrt'], tileSize: 512}},
    );
    try {
        // Don't wait for idle (depends on tile load completion); just wait for
        // setupHD() to fire, which happens on the first render frame.
        await waitForLoaded(HD);
        expect(HD.loaded).toBe(true);
        expect(Standard.loaded).toBeUndefined();
    } finally {
        map.remove();
    }
});
