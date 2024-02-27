import {vi, describe, test, expect} from "../../util/vitest.js";
import {getPNGResponse} from '../../util/network.js';
import {
    getArrayBuffer,
    getJSON,
    postData,
    getImage,
    resetImageRequestQueue
} from '../../../src/util/ajax.js';
import config from '../../../src/util/config.js';
import webpSupported from '../../../src/util/webp_supported.js';

describe('ajax', () => {
    test('getArrayBuffer, 404', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 404
            });
        });

        await new Promise(resolve => {
            getArrayBuffer({url:''}, (error) => {
                expect(error.status).toEqual(404);
                resolve();
            });
        });
    });

    test('getJSON', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('{"foo": "bar"}', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        });

        await new Promise(resolve => {
            getJSON({url:''}, (error, body) => {
                expect(error).toBeFalsy();
                expect(body).toEqual({foo: 'bar'});
                resolve();
            });
        });
    });

    test('getJSON, invalid syntax', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('how do i even', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        });

        await new Promise(resolve => {
            getJSON({url:''}, (error) => {
                expect(error).toBeTruthy();
                resolve();
            });
        });
    });

    test('getJSON, 404', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 404
            });
        });

        await new Promise(resolve => {
            getJSON({url:''}, (error) => {
                expect(error.status).toEqual(404);
                resolve();
            });
        });
    });

    test('getJSON, 401: non-Mapbox domain', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 401,
                statusText: 'Unauthorized'
            });
        });

        await new Promise(resolve => {
            getJSON({url:''}, (error) => {
                expect(error.status).toEqual(401);
                expect(error.message).toEqual("Unauthorized");
                resolve();
            });
        });
    });

    test('getJSON, 401: Mapbox domain', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 401,
                statusText: 'Unauthorized'
            });
        });

        await new Promise(resolve => {
            getJSON({url:'api.mapbox.com'}, (error) => {
                expect(error.status).toEqual(401);
                expect(error.message).toEqual(
                    "Unauthorized: you may have provided an invalid Mapbox access token. See https://docs.mapbox.com/api/overview/#access-tokens-and-token-scopes"
                );
                resolve();
            });
        });
    });

    test('postData, 204(no content): no error', async () => {
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response(null, {
                status: 204
            });
        });

        await new Promise(resolve => {
            postData({url:'api.mapbox.com'}, (error) => {
                expect(error).toEqual(null);
                resolve();
            });
        });
    });

    test('getImage respects maxParallelImageRequests', async () => {
        const requests = [];
        vi.spyOn(window, 'fetch').mockImplementation(async (req) => {
            requests.push(req);

            return new window.Response(await getPNGResponse(), {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            });
        });

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        await new Promise(resolve => {
            function callback(err) {
                if (err) return;
                // last request is only added after we got a response from one of the previous ones
                expect(requests.length).toEqual(maxRequests + 1);
                resolve();
            }

            for (let i = 0; i < maxRequests + 1; i++) {
                getImage({url: ''}, callback);
            }

            expect(requests.length).toEqual(maxRequests);
        });
    });

    test('getImage cancelling frees up request for maxParallelImageRequests', () => {
        resetImageRequestQueue();

        const requests = [];
        vi.spyOn(window, 'fetch').mockImplementation(async (req) => {
            requests.push(req);

            return new window.Response(await getPNGResponse(), {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            });
        });

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        for (let i = 0; i < maxRequests + 1; i++) {
            getImage({url: ''}, expect.unreachable).cancel();
        }

        expect(requests.length).toEqual(maxRequests + 1);
    });

    test('getImage requests that were once queued are still abortable', () => {
        resetImageRequestQueue();

        const serverRequests = [];
        vi.spyOn(window, 'fetch').mockImplementation(async (req) => {
            serverRequests.push(req);

            return new window.Response(await getPNGResponse(), {
                status: 200,
                headers: {
                    'Content-Type': 'image/png'
                }
            });
        });

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const requests = [];
        for (let i = 0; i < maxRequests; i++) {
            requests.push(getImage({url: ''}, () => {}));
        }

        // the limit of allowed requests is reached
        expect(serverRequests.length).toEqual(maxRequests);

        const queuedURL = 'this-is-the-queued-request';
        const queued = getImage({url: queuedURL}, () => expect.unreachable());

        // the new requests is queued because the limit is reached
        expect(serverRequests.length).toEqual(maxRequests);

        // cancel the first request to let the queued request start
        requests[0].cancel();
        expect(serverRequests.length).toEqual(maxRequests + 1);

        // abort the previously queued request and confirm that it is aborted
        const queuedRequest = serverRequests[serverRequests.length - 1];
        expect(queuedRequest.url).toMatch(queuedURL);
        expect(queuedRequest.signal.aborted).toEqual(false);
        queued.cancel();
        expect(queuedRequest.signal.aborted).toEqual(true);
    });

    test('getImage sends accept/webp when supported', async () => {
        resetImageRequestQueue();

        await new Promise(resolve => {
            vi.spyOn(window, 'fetch').mockImplementation((req) => {
                expect(req.headers.get('accept').includes('image/webp')).toBeTruthy();
                resolve();
            });

            webpSupported.supported = true;

            getImage({url: ''}, () => {});
        });
    });

    test.skip('getImage retains cache control headers when using arrayBufferToImage', async () => {
        resetImageRequestQueue();

        const headers = {
            'Content-Type': 'image/webp',
            'Cache-Control': 'max-age=43200,s-maxage=604800',
            'Expires': 'Wed, 21 Oct 2099 07:28:00 GMT'
        };

        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response(await getPNGResponse(), {
                status: 200,
                headers
            });
        });

        await new Promise(resolve => {
            getImage({url: ''}, (err, img, cacheControl, expires) => {
                if (err) expect.unreachable();
                expect(cacheControl).toEqual(headers['Cache-Control']);
                expect(expires).toEqual(headers['Expires']);
                resolve();
            });

        });
    });

    test.skip('getImage retains cache control headers when using arrayBufferToImageBitmap', async () => {
        resetImageRequestQueue();

        const headers = {
            'Content-Type': 'image/webp',
            'Cache-Control': 'max-age=43200,s-maxage=604800',
            'Expires': 'Wed, 21 Oct 2015 07:28:00 GMT'
        };

        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response(await getPNGResponse(), {
                status: 200,
                headers
            });
        });

        await new Promise(resolve => {
            getImage({url: ''}, (err, img, cacheControl, expires) => {
                if (err) expect.unreachable();
                expect(cacheControl).toEqual(headers['Cache-Control']);
                expect(expires).toEqual(headers['Expires']);
                resolve();
            });
        });
    });
});
