import {describe, test, expect, vi} from 'vitest';

/* eslint-disable camelcase */
describe('pmtiles_provider', () => {
    describe('PMTilesProvider', () => {
        test('constructor without url throws', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');
            expect(() => new PMTilesProvider({type: 'vector'} as {type: 'vector'; url: string})).toThrow('PMTilesProvider requires a source url');
        });

        test('load delegates to PMTiles.getTileJson with the source URL', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');
            const {PMTiles} = await import('pmtiles');

            const url = 'http://example.com/tilejson-test.pmtiles';
            const fakeTileJSON = {
                tilejson: '3.0.0',
                scheme: 'xyz',
                tiles: [`${url}/{z}/{x}/{y}.mvt`],
                vector_layers: [{id: 'water', fields: {}}],
                attribution: 'Test',
                name: 'test-archive',
                bounds: [-180, -85, 180, 85],
                center: [0, 0, 3],
                minzoom: 0,
                maxzoom: 14,
            };
            const spy = vi.spyOn(PMTiles.prototype, 'getTileJson').mockResolvedValue(fakeTileJSON);

            const provider = new PMTilesProvider({type: 'vector', url});
            const tileJSON = await provider.load();

            expect(spy).toHaveBeenCalledWith(url);
            expect(tileJSON).toEqual(fakeTileJSON);

            spy.mockRestore();
        });

        test('getZxy returns null → loadTile returns null', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');
            const {PMTiles} = await import('pmtiles');

            const url = 'http://example.com/test.pmtiles';
            const spy = vi.spyOn(PMTiles.prototype, 'getZxy').mockResolvedValue(undefined);

            const provider = new PMTilesProvider({type: 'vector', url});
            const result = await provider.loadTile(
                {z: 0, x: 0, y: 0},
                {signal: new AbortController().signal},
            );

            expect(result).toBeNull();
            spy.mockRestore();
        });

    });
});
