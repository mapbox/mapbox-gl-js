import {test, expect, waitFor} from '../../util/vitest';
import {HD} from '../../../modules/hd_main_esm';
import {makeMap, settle} from './helpers';

test('standard-style-like layers (fill/line/symbol/fill-extrusion) do not load HD', async () => {
    const geojson = {type: 'FeatureCollection', features: [{
        type: 'Feature', properties: {height: 20},
        geometry: {type: 'Polygon', coordinates: [[[0, 0], [0, 0.01], [0.01, 0.01], [0.01, 0], [0, 0]]]},
    }]};
    const map = makeMap(
        [
            {id: 'fill',    type: 'fill',           source: 'geo', paint: {}},
            {id: 'line',    type: 'line',           source: 'geo', paint: {}},
            {id: 'symbol',  type: 'symbol',         source: 'geo', layout: {}},
            {id: 'extrude', type: 'fill-extrusion', source: 'geo', paint: {'fill-extrusion-height': ['get', 'height']}},
        ],
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
