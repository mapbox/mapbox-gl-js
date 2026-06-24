// Precipitation triggers HD via a separate code path in painter.ts (line ~1169)
// that is independent of mayUse and renderLayer. This test exercises that path.
import {test, expect, waitFor} from '../../util/vitest';
import {HD} from '../../../modules/hd_main_esm';
import {makeMap, waitForLoaded} from './helpers';

test('rain precipitation triggers HD loading via painter path', async () => {
    const map = makeMap();
    try {
        await waitFor(map, 'idle');
        map.painter._debugParams.forceEnablePrecipitation = true;
        map.triggerRepaint();
        await waitForLoaded(HD);
        expect(HD.loaded).toBe(true);
    } finally {
        map.remove();
    }
});
