// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, beforeEach, expect, vi} from '../../util/vitest';
import {cacheGet, cachePut, cacheClose} from '../../../src/util/tile_request_cache';

describe('tile_request_cache', () => {
    beforeEach(() => {
        vi.stubGlobal('caches', {});
        cacheClose();
    });

    test('cachePut, no window.caches', async () => {
        delete window.caches;

        await expect(cachePut({url: ''})).resolves.toBeUndefined();
    });

    test('cacheGet, no window.caches', async () => {
        delete window.caches;

        const result = await cacheGet({url: ''});
        expect(result).toEqual(null);
    });

    test('cacheGet, cache open error', async () => {
        window.caches.open = vi.fn().mockRejectedValue(new Error('The operation is insecure'));

        await expect(cacheGet(new Request(''))).rejects.toThrow('The operation is insecure');
    });

    test('cacheGet, cache match error', async () => {
        const fakeCache = vi.fn();
        const fakeURL = new Request('someurl').url;
        fakeCache.match = vi.fn().mockImplementation((url) => {
            if (url === fakeURL) {
                return Promise.reject(new Error('ohno'));
            }
        });
        window.caches.open = vi.fn().mockResolvedValue(fakeCache);

        await expect(cacheGet(new Request(fakeURL))).rejects.toThrow('ohno');
    });

    test('cacheGet, happy path', async () => {
        const cachedRequest = new Request(`someurl?language=es&worldview=US&jobid=12345&range=${encodeURIComponent('bytes=0-')}`);
        const cachedResponse = {
            headers: {get: vi.fn().mockImplementation((name) => {
                switch (name) {
                case 'expires':
                    return '2300-01-01';
                case 'cache-control':
                    return null;
                }
            })},
            clone: vi.fn().mockImplementation(() => cachedResponse),
            body: 'yay'
        };

        const fakeCache = vi.fn();
        // eslint-disable-next-line @typescript-eslint/require-await
        fakeCache.match = vi.fn().mockImplementation(async (url) => (url === cachedRequest.url ? cachedResponse : undefined)
        );
        fakeCache.delete = vi.fn(() => Promise.resolve());
        fakeCache.put = vi.fn(() => Promise.resolve());

        window.caches.open = vi.fn().mockImplementation(() => Promise.resolve(fakeCache));

        // ensure that the language, worldview, and jobid query parameters are retained,
        // the Range header is added to the query string, but other query parameters are stripped
        const request = new Request(`someurl?language=es&worldview=US&jobid=12345&accessToken=foo`);
        request.headers.set('Range', 'bytes=0-');

        const {response, fresh} = await cacheGet(request);
        expect(fakeCache.match).toHaveBeenCalledWith(cachedRequest.url);
        expect(fakeCache.delete).toHaveBeenCalledWith(cachedRequest.url);
        expect(response).toBeTruthy();
        expect(response.body).toEqual('yay');
        expect(fresh).toBeTruthy();
        expect(fakeCache.put).toHaveBeenCalledWith(cachedRequest.url, cachedResponse);
    });
});
