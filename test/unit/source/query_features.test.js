import {describe, test, expect} from "../../util/vitest.js";
import {
    queryRenderedFeatures,
    querySourceFeatures
} from '../../../src/source/query_features.js';
import SourceCache from '../../../src/source/source_cache.js';
import {create} from '../../../src/source/source.js';
import Transform from '../../../src/geo/transform.js';

describe('QueryFeatures#rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockSourceCache = {tilesIn () { return []; }};
        const transform = new Transform();
        const result = queryRenderedFeatures(mockSourceCache, {}, undefined, {}, undefined, undefined, transform);
        expect(result).toEqual({});
    });
});

describe('QueryFeatures#source', () => {
    test('returns empty result when source has no features', () => {
        const source = create('test', {
            type: 'geojson',
            data: {type: 'FeatureCollection', features: []}
        }, {
            getActor() {
                return {
                    send(type, params, callback) { return callback(); }
                };
            }
        }, this);
        const sourceCache = new SourceCache('test', source);
        const result = querySourceFeatures(sourceCache, {});
        expect(result).toEqual([]);
    });
});
