import {describe, test, beforeEach, expect, vi} from "../../util/vitest.js";
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

        cacheGet({url:''}, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toEqual('The operation is insecure');
        });
    });

    test('cacheGet, cache match error', () => {
        const fakeCache = vi.fn();
        fakeCache.match = vi.fn().mockImplementation((url) => {
            if (url === 'someurl') {
                return Promise.reject(new Error('ohno'));
            }
        });
        window.caches.open = vi.fn().mockResolvedValue(fakeCache);

        cacheGet({url:'someurl'}, (error) => {
            expect(error).toBeTruthy();
            expect(error.message).toEqual('ohno');
        });
    });

    test('cacheGet, happy path', async () => {
        const fakeResponse = {
            headers: {get: vi.fn().mockImplementation((name) => {
                switch (name) {
                case 'Expires':
                    return '2300-01-01';
                case 'Cache-Control':
                    return null;
                }
            })},
            clone: vi.fn().mockImplementation(() => fakeResponse),
            body: 'yay'
        };

        const fakeURL = 'someurl?language="es"&worldview="US"';
        const fakeCache = vi.fn();
        fakeCache.match = vi.fn().mockImplementation(async (url) => {
            if (url === fakeURL) {
                return fakeResponse;
            }
        });
        fakeCache.delete = vi.fn();
        fakeCache.put = vi.fn();

        window.caches.open = vi.fn().mockImplementation(() => Promise.resolve(fakeCache));

        await new Promise(resolve => {

            // ensure that the language and worldview query parameters are retained but other query parameters aren't
            cacheGet({url: `${fakeURL}&accessToken="foo"`}, (error, response, fresh) => {
                expect(error).toBeFalsy();
                expect(fakeCache.match).toHaveBeenCalledWith(fakeURL);
                expect(fakeCache.delete).toHaveBeenCalledWith(fakeURL);
                expect(response).toBeTruthy();
                expect(response.body).toEqual('yay');
                expect(fresh).toBeTruthy();
                expect(fakeCache.put).toHaveBeenCalledWith(fakeURL, fakeResponse);
                resolve();
            });
        });
    });
});
