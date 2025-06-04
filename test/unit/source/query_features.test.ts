import {describe, test, expect} from '../../util/vitest';
import {
    queryRenderedFeatures,
    querySourceFeatures
} from '../../../src/source/query_features';
import SourceCache from '../../../src/source/source_cache';
import {create} from '../../../src/source/source';
import Transform from '../../../src/geo/transform';

import type Dispatcher from '../../../src/util/dispatcher';

describe('QueryFeatures#rendered', () => {
    test('returns empty object if source returns no tiles', () => {
        const mockSourceCache = {tilesIn() { return []; }} as unknown as SourceCache;
        const query = {sourceCache: mockSourceCache, layers: {}};
        const transform = new Transform();
        const result = queryRenderedFeatures(undefined, query, [], transform, false);
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
                    send(type, params, callback) { return callback ? callback() : undefined; }
                };
            }
        } as Dispatcher, this);
        const sourceCache = new SourceCache('test', source);
        const result = querySourceFeatures(sourceCache, {});
        expect(result).toEqual([]);
    });
});
