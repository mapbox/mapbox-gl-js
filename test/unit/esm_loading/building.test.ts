import {test, expect, waitFor} from '../../util/vitest';
import {HD} from '../../../modules/hd_main_esm';
import {makeMap, waitForLoaded} from './helpers';

test('building layer triggers HD loading', async () => {
    const geojson = {type: 'FeatureCollection', features: [{
        type: 'Feature', properties: {},
        geometry: {type: 'Polygon', coordinates: [[[0, 0], [0, 0.01], [0.01, 0.01], [0.01, 0], [0, 0]]]},
    }]};
    const map = makeMap(
        [{id: 'bldg', type: 'building', source: 'geo', layout: {'building-base': 0, 'building-height': 10}, paint: {}}],
        {geo: {type: 'geojson', data: geojson}},
    );
    try {
        await waitFor(map, 'idle');
        await waitForLoaded(HD);
        expect(HD.loaded).toBe(true);
    } finally {
        map.remove();
    }
});
