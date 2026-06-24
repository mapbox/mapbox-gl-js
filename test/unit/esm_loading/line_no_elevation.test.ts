import {test, expect, waitFor} from '../../util/vitest';
import {HD} from '../../../modules/hd_main_esm';
import {makeMap, settle} from './helpers';

test('line without elevation reference does not load HD', async () => {
    const geojson = {type: 'FeatureCollection', features: [{
        type: 'Feature', properties: {},
        geometry: {type: 'LineString', coordinates: [[0, 0], [0.01, 0.01]]},
    }]};
    const map = makeMap(
        [{id: 'road', type: 'line', source: 'geo', paint: {}}],
        {geo: {type: 'geojson', data: geojson}},
    );
    try {
        await waitFor(map, 'idle');
        await settle();
        expect(HD.loaded).toBeUndefined();
    } finally {
        map.remove();
    }
});
