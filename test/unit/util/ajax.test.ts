// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi, describe, test, expect} from '../../util/vitest';
import {getPNGResponse} from '../../util/network';
import {
    getArrayBuffer,
    getJSON,
    postData,
    getImage,
    resetImageRequestQueue
} from '../../../src/util/ajax';
import config from '../../../src/util/config';
import webpSupported from '../../../src/util/webp_supported';

class MockXMLHttpRequest {
    static lastInstance: MockXMLHttpRequest | null = null;

    readyState = 0;
    status = 0;
    response = "";
    responseText = "";
    responseHeaders: Record<string, string> = {};
    onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null = null;
    onload: ((this: XMLHttpRequest, ev: Event) => any) | null = null;
    onerror: ((this: XMLHttpRequest, ev: Event) => any) | null = null;

    open = vi.fn((method: string, url: string) => {
        this.readyState = 1;
        this._triggerChange();
    });

    send = vi.fn(() => {
    // Simulate async network delay
        setTimeout(() => {
            this.readyState = 4;
            this.status = 200;
            this.response = JSON.stringify({ok: true});
            this.responseText = JSON.stringify({ok: true});
            this.responseHeaders = {
                'Content-Type': 'application/json',
                'X-random-header': 'random-value'
            };

            this._triggerChange();
            this.onload?.(new Event("load"));
        }, 0);
    });

    setRequestHeader = vi.fn();

    abort = vi.fn();

    constructor() {
        MockXMLHttpRequest.lastInstance = this;
    }

    private _triggerChange() {
        this.onreadystatechange?.(new Event("readystatechange"));
    }

    getAllResponseHeaders = vi.fn(() => {
        return Object.entries(this.responseHeaders)
            .map(([key, value]) => `${key}: ${value}`)
            .join("\r\n");
    });
}

describe('ajax', () => {
    test('getArrayBuffer, 404', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 404
            });
        });

        await new Promise(resolve => {
            getArrayBuffer({url: ''}, (error) => {
                expect(error.status).toEqual(404);
                resolve();
            });
        });
    });

    test('getJSON', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('{"foo": "bar"}', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        });

        await new Promise(resolve => {
            getJSON({url: ''}, (error, body) => {
                expect(error).toBeFalsy();
                expect(body).toEqual({foo: 'bar'});
                resolve();
            });
        });
    });

    test('getJSON, invalid syntax', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('how do i even', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        });

        await new Promise(resolve => {
            getJSON({url: ''}, (error) => {
                expect(error).toBeTruthy();
                resolve();
            });
        });
    });

    test('getJSON, 404', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 404
            });
        });

        await new Promise(resolve => {
            getJSON({url: ''}, (error) => {
                expect(error.status).toEqual(404);
                resolve();
            });
        });
    });

    test('getJSON, 401: non-Mapbox domain', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 401,
                statusText: 'Unauthorized'
            });
        });

        await new Promise(resolve => {
            getJSON({url: ''}, (error) => {
                expect(error.status).toEqual(401);
                expect(error.message).toEqual("Unauthorized");
                resolve();
            });
        });
    });

    test('getJSON, 401: Mapbox domain', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 401,
                statusText: 'Unauthorized'
            });
        });

        await new Promise(resolve => {
            getJSON({url: 'api.mapbox.com'}, (error) => {
                expect(error.status).toEqual(401);
                expect(error.message).toEqual(
                    "Unauthorized: you may have provided an invalid Mapbox access token. See https://docs.mapbox.com/api/overview/#access-tokens-and-token-scopes"
                );
                resolve();
            });
        });
    });

    test('makeRequest gets correct headers when using fetch', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('{"foo": "bar"}', {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-random-header': 'random-value'
                }
            });
        });

        await new Promise(resolve => {
            getJSON({url: ''}, (error, body, headers) => {
                expect(headers.get('X-random-header')).toEqual('random-value');
                expect(headers.get('Content-Type')).toEqual('application/json');
                resolve();
            });
        });
    });

    test('makeRequest gets correct headers when using XMLHttpRequest', async () => {
        vi.spyOn(window, 'XMLHttpRequest').mockImplementation(() => new MockXMLHttpRequest());

        await new Promise(resolve => {
            getJSON({url: 'file://random'}, (error, body, headers) => {
                expect(error).toBeNull();
                expect(headers.get('X-random-header')).toEqual('random-value');
                expect(headers.get('Content-Type')).toEqual('application/json');
                resolve();
            });
        });
    });

    test('postData, 204(no content): no error', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response(null, {
                status: 204
            });
        });

        await new Promise(resolve => {
            postData({url: 'api.mapbox.com'}, (error) => {
                expect(error).toEqual(null);
                resolve();
            });
        });
    });

    test('getImage respects maxParallelImageRequests', async () => {
        const requests: Array<any> = [];
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

        const requests: Array<any> = [];
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

        const serverRequests: Array<any> = [];
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

        const requests: Array<any> = [];
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        requests[0].cancel();
        expect(serverRequests.length).toEqual(maxRequests + 1);

        // abort the previously queued request and confirm that it is aborted
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const queuedRequest = serverRequests[serverRequests.length - 1];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(queuedRequest.url).toMatch(queuedURL);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(queuedRequest.signal.aborted).toEqual(false);
        queued.cancel();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(queuedRequest.signal.aborted).toEqual(true);
    });

    test('getImage sends accept/webp when supported', async () => {
        resetImageRequestQueue();

        await new Promise(resolve => {
            vi.spyOn(window, 'fetch').mockImplementation((req) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
