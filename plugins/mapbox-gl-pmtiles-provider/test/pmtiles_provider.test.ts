import {describe, test, expect, vi} from 'vitest';

/* eslint-disable camelcase */
describe('pmtiles_provider', () => {
    describe('PMTilesProvider', () => {
        test('constructor without url throws', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');
            expect(() => new PMTilesProvider({type: 'vector'})).toThrow('PMTilesProvider requires a source url');
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
            const tileJSON = await provider.load({request: {url}});

            expect(spy).toHaveBeenCalledWith(url);
            expect(tileJSON).toEqual(fakeTileJSON);

            spy.mockRestore();
        });

        test('loadTile returns data with cache headers', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');
            const {PMTiles} = await import('pmtiles');
            const data = new ArrayBuffer(16);
            const spy = vi.spyOn(PMTiles.prototype, 'getZxy').mockResolvedValue({
                data, cacheControl: 'max-age=300', expires: 'Thu, 01 Jan 2099 00:00:00 GMT',
            });
            const url = 'http://example.com/test.pmtiles';
            const provider = new PMTilesProvider({type: 'vector', url});
            const result = await provider.loadTile({z: 1, x: 0, y: 0}, {request: {url}, signal: new AbortController().signal});
            expect(result).toEqual({data, cacheControl: 'max-age=300', expires: 'Thu, 01 Jan 2099 00:00:00 GMT'});
            spy.mockRestore();
        });

        test('loadTile propagates getZxy errors', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');
            const {PMTiles} = await import('pmtiles');
            const spy = vi.spyOn(PMTiles.prototype, 'getZxy').mockRejectedValue(new Error('network error'));
            const url = 'http://example.com/test.pmtiles';
            const provider = new PMTilesProvider({type: 'vector', url});
            await expect(provider.loadTile({z: 0, x: 0, y: 0}, {request: {url}, signal: new AbortController().signal}))
                .rejects.toThrow('network error');
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
                {request: {url}, signal: new AbortController().signal},
            );

            expect(result).toBeNull();
            spy.mockRestore();
        });

        test('loadTile forwards request options to fetch', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');

            const url = 'http://example.com/test.pmtiles';
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ArrayBuffer(0)));

            const provider = new PMTilesProvider({type: 'vector', url});
            const request = {url, headers: {Authorization: 'SECRET'}, credentials: 'include' as const};
            await provider.loadTile({z: 0, x: 0, y: 0}, {request, signal: new AbortController().signal}).catch(() => {});

            expect(fetchSpy).toHaveBeenCalled();
            const init = fetchSpy.mock.calls[0][1];
            if (!init) throw new Error('fetch was called without a RequestInit');
            expect((init.headers as Headers).get('Authorization')).toBe('SECRET');
            expect(init.credentials).toBe('include');

            fetchSpy.mockRestore();
        });

        test('load forwards request options to fetch', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');

            const url = 'http://example.com/test.pmtiles';
            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new ArrayBuffer(0)));

            const provider = new PMTilesProvider({type: 'vector', url});
            const request = {url, headers: {Authorization: 'SECRET'}, credentials: 'include' as const};
            await provider.load({request}).catch(() => {});

            expect(fetchSpy).toHaveBeenCalled();
            const init = fetchSpy.mock.calls[0][1];
            if (!init) throw new Error('fetch was called without a RequestInit');
            expect((init.headers as Headers).get('Authorization')).toBe('SECRET');
            expect(init.credentials).toBe('include');

            fetchSpy.mockRestore();
        });

        test('reuses cached archive metadata across request option changes', async () => {
            const {default: PMTilesProvider} = await import('../src/pmtiles_provider');

            const archive = new ArrayBuffer(128);
            const header = new DataView(archive);
            header.setUint16(0, 19792, true);
            header.setUint8(7, 3);
            header.setUint32(8, 127, true);
            header.setUint32(16, 1, true);
            header.setUint8(97, 1);
            header.setUint8(98, 1);
            header.setUint8(99, 1);

            const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive, {
                status: 206,
            }));

            const url = 'http://example.com/test-shared-cache.pmtiles';
            const provider = new PMTilesProvider({type: 'vector', url});
            const tile = {z: 1, x: 0, y: 0};
            await provider.loadTile(tile, {request: {url}, signal: new AbortController().signal});
            await provider.loadTile(tile, {request: {url, credentials: 'include'}, signal: new AbortController().signal});

            expect(fetchSpy).toHaveBeenCalledOnce();

            fetchSpy.mockRestore();
        });
    });
});
