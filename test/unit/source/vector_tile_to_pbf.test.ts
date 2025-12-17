import {test, expect} from '../../util/vitest';
import writePbf from '../../../src/source/vector_tile_to_pbf';
import Pbf from 'pbf';
import {VectorTile} from '@mapbox/vector-tile';

import type {Feature} from '../../../src/source/geojson_wrapper';

test('loadData does not error on non-numeric feature IDs', () => {
    const features: Feature[] = [{
        id: "41e1195014088091",
        type: 1,
        tags: {},
        geometry: [[0, 0]]
    }, {
        id: "-Infinity",
        type: 1,
        tags: {},
        geometry: [[0, 0]]
    }, {
        id: "NaN",
        type: 1,
        tags: {},
        geometry: [[0, 0]]
    }];

    expect(() => {
        writePbf({test: features});
    }).not.toThrowError();
});

test('does not encode empty rings', () => {
    const features: Feature[] = [{
        id: 1,
        type: 2,
        tags: {},
        geometry: [[[0, 0]], []]
    }];

    expect(() => {
        const buf = writePbf({test: features});
        const tile = new VectorTile(new Pbf(buf));
        tile.layers.test.feature(0).loadGeometry();
    }).not.toThrowError();
});
