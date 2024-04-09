import {describe, test, beforeEach, expect, vi} from '../../util/vitest.js';
import {cacheGet, cachePut, cacheClose} from '../../../src/util/tile_request_cache.js';

describe('tile_request_cache', () => {
    beforeEach(() => {
        vi.stubGlobal('caches', {});
        cacheClose();
    });

    test('cachePut, no window.caches', () => {
        delete window.caches;

        let result;
        try {
            result = cachePut({url:''});
            expect(result).toBeFalsy();
        } catch (e) {
            expect.unreacheble('should not result in error');
        }
    });

    test('cacheGet, no window.caches', () => {
        delete window.caches;

        cacheGet({url:''}, (result) => {
            expect(result).toEqual(null);
        });
    });

    test('cacheGet, cache open error', () => {
        window.caches.open = vi.fn().mockRejectedValue(new Error('The operation is insecure'));

        cacheGet(new Request(''), (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toEqual('The operation is insecure');
        });
    });

    test('cacheGet, cache match error', () => {
        const fakeCache = vi.fn();
        const fakeURL = new Request('someurl').url;
        fakeCache.match = vi.fn().mockImplementation((url) => {
            if (url === fakeURL) {
                return Promise.reject(new Error('ohno'));
            }
        });
        window.caches.open = vi.fn().mockResolvedValue(fakeCache);

        cacheGet(new Request(fakeURL), (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toEqual('ohno');
        });
    });

    test('cacheGet, happy path', async () => {
        const cachedRequest = new Request(`someurl?language=es&worldview=US&range=${encodeURIComponent('bytes=0-')}`);
        const cachedResponse = {
            headers: {get: vi.fn().mockImplementation((name) => {
                switch (name) {
                case 'Expires':
                    return '2300-01-01';
                case 'Cache-Control':
                    return null;
                }
            })},
            clone: vi.fn().mockImplementation(() => cachedResponse),
            body: 'yay'
        };

        const fakeCache = vi.fn();
        fakeCache.match = vi.fn().mockImplementation(async (url) =>
            url === cachedRequest.url ? cachedResponse : undefined
        );
        fakeCache.delete = vi.fn();
        fakeCache.put = vi.fn();

        window.caches.open = vi.fn().mockImplementation(() => Promise.resolve(fakeCache));

        await new Promise(resolve => {
            // ensure that the language and worldview query parameters are retained,
            // the Range header is added to the query string, but other query parameters are stripped
            const request = new Request(`someurl?language=es&worldview=US&accessToken=foo`);
            request.headers.set('Range', 'bytes=0-');

            cacheGet(request, (error, response, fresh) => {
                expect(error).toBeFalsy();
                expect(fakeCache.match).toHaveBeenCalledWith(cachedRequest.url);
                expect(fakeCache.delete).toHaveBeenCalledWith(cachedRequest.url);
                expect(response).toBeTruthy();
                expect(response.body).toEqual('yay');
                expect(fresh).toBeTruthy();
                expect(fakeCache.put).toHaveBeenCalledWith(cachedRequest.url, cachedResponse);
                resolve();
            });
        });
    });
});
