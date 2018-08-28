import { test } from 'mapbox-gl-js-test';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from '../../../src/source/query_features.js';
import SourceCache from '../../../src/source/source_cache.js';
import Transform from '../../../src/geo/transform.js';

test('QueryFeatures#rendered', (t) => {
    t.test('returns empty object if source returns no tiles', (t) => {
        const mockSourceCache = { tilesIn: function () { return []; } };
        const transform = new Transform();
        const result = queryRenderedFeatures(mockSourceCache, undefined, {}, undefined, transform);
        t.deepEqual(result, []);
        t.end();
    });

    t.end();
});

test('QueryFeatures#source', (t) => {
    t.test('returns empty result when source has no features', (t) => {
        const sourceCache = new SourceCache('test', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        }, {
            send: function (type, params, callback) { return callback(); }
        });
        const result = querySourceFeatures(sourceCache, {});
        t.deepEqual(result, []);
        t.end();
    });

    t.end();
});
