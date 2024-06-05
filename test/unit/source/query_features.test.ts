// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from '../../../src/source/query_features';
import SourceCache from '../../../src/source/source_cache';
import {create} from '../../../src/source/source';
import Transform from '../../../src/geo/transform';

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
