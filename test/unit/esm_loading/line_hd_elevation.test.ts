import {test, expect, waitFor} from '../../util/vitest';
import {HD} from '../../../modules/hd_main_esm';
import {makeMap, waitForLoaded} from './helpers';

test('line with hd-road-markup elevation triggers HD loading', async () => {
    const geojson = {type: 'FeatureCollection', features: [{
        type: 'Feature', properties: {},
        geometry: {type: 'LineString', coordinates: [[0, 0], [0.01, 0.01]]},
    }]};
    const map = makeMap(
        [{id: 'road', type: 'line', source: 'geo', layout: {'line-elevation-reference': 'hd-road-markup'}, paint: {}}],
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
