// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {vi, describe, test, expect} from '../../util/vitest';
import {getPNGResponse} from '../../util/network';
import {
    getArrayBuffer,
    getData,
    getJSON,
    postData,
    getImage,
    getVideo,
    resetImageRequestQueue
} from '../../../src/util/ajax';
import config from '../../../src/util/config';
import webpSupported from '../../../src/util/webp_supported';

describe('ajax', () => {
    test('getArrayBuffer, 404', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 404
            });
        });

        await expect(getArrayBuffer({url: ''})).rejects.toMatchObject({status: 404});
    });

    test('getArrayBuffer network failure keeps the request URL in the message', async () => {
        vi.spyOn(window, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

        const url = 'https://example.com/tile.pbf?access_token=pk.test';
        await expect(getArrayBuffer({url})).rejects.toThrow(`Failed to fetch ${url}`);
    });

    test('getJSON, 401: non-Mapbox domain', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('', {
                status: 401,
                statusText: 'Unauthorized'
            });
        });

        await expect(getJSON({url: ''})).rejects.toMatchObject({
            status: 401,
            message: "Unauthorized"
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

        await expect(getJSON({url: 'api.mapbox.com'})).rejects.toMatchObject({
            status: 401,
            message: "Unauthorized: you may have provided an invalid Mapbox access token. See https://docs.mapbox.com/api/guides/#access-tokens-and-token-scopes"
        });
    });

    test('getJSON gets correct headers when using XMLHttpRequest', async () => {
        vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
            const responseHeadersRef: {current: Record<string, string>} = {
                current: {}
            };
            const requestHeadersRef: {current: Record<string, string>} = {
                current: {}
            };

            this.open = () => {
                this.readyState = 1;
                this.onreadystatechange?.(new Event("readystatechange"));
            };
            this.getAllResponseHeaders = () => {
                return Object.entries(responseHeadersRef.current)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\r\n");
            };
            this.setRequestHeader = (key: string, value: string) => {
                requestHeadersRef.current[key] = value;
            };
            this.send = () => {
                setTimeout(() => {
                    this.readyState = 4;
                    this.status = 200;
                    this.response = JSON.stringify({ok: true});
                    this.responseText = JSON.stringify({ok: true});
                    responseHeadersRef.current = {
                        'Content-Type': 'application/json',
                        'X-random-header': 'random-value'
                    };

                    this.onload?.(new Event("load"));
                }, 0);
            };
        });

        const {headers} = await getJSON({url: 'file://random'});
        expect(headers.get('x-random-header')).toEqual('random-value');
        expect(headers.get('content-type')).toEqual('application/json');
    });

    test('postData, 204(no content): no error', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response(null, {
                status: 204
            });
        });

        await expect(postData({url: 'api.mapbox.com'})).resolves.toBeDefined();
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

    test('getImage does not deliver to callback when cancelled mid-body-read', async () => {
        // Prep async work first, then drain any in-flight requests leaked by earlier tests
        // (they decrement the shared queue counter as they settle) before resetting, so the
        // counter is clean and cancel() below can't underflow it.
        const body = await getPNGResponse();
        await new Promise(r => { setTimeout(r, 0); });
        resetImageRequestQueue();

        // Resolve fetch immediately but hold the body read, so cancel() lands in the window
        // after fetch resolved (the abort is therefore not surfaced as an AbortError) but
        // before the body completes. The pre-Promise Cancelable contract dropped the callback
        // here; the Promise bridge must preserve that or it resurrects stale ImageSource state.
        let resolveBody: () => void;
        vi.spyOn(window, 'fetch').mockImplementation(() => Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({'Content-Type': 'image/png'}),
            arrayBuffer: () => new Promise((resolve) => { resolveBody = () => resolve(body); }),
        }));

        // Make the image-bitmap conversion resolve on a controlled microtask so the success
        // delivery is deterministic; otherwise the real decode might just not have fired yet
        // by the assertion, masking a missing guard.
        const createImageBitmap = vi.spyOn(window, 'createImageBitmap').mockResolvedValue({} as ImageBitmap);

        const callback = vi.fn();
        const request = getImage({url: ''}, callback);

        // Let the chain advance past the post-fetch abort check, into the body read.
        await new Promise(r => { setTimeout(r, 0); });
        expect(typeof resolveBody).toBe('function');

        request.cancel();
        resolveBody();

        // Flush the microtasks the conversion + callback would otherwise use.
        await new Promise(r => { setTimeout(r, 0); });

        expect(createImageBitmap).not.toHaveBeenCalled();
        expect(callback).not.toHaveBeenCalled();
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
        const queuedRequest = serverRequests.at(-1);
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

    test('getJSON resolves with {data, headers: Headers}', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('{"foo":1}', {
                status: 200,
                headers: {'Content-Type': 'application/json', 'X-Custom': 'yes'}
            });
        });

        const result = await getJSON({url: ''});
        expect(result.data).toEqual({foo: 1});
        expect(result.headers).toBeInstanceOf(Headers);
        expect(result.headers.get('x-custom')).toEqual('yes');
    });

    test('getData rejects immediately when signal already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        let fetchCalled = false;
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            fetchCalled = true;
            return new window.Response('', {status: 200});
        });

        await expect(getData({url: ''}, controller.signal)).rejects.toMatchObject({name: 'AbortError'});
        expect(fetchCalled).toEqual(false);
    });

    test('getArrayBuffer rejects with AbortError when signal fires mid-flight', async () => {
        const controller = new AbortController();
        vi.spyOn(window, 'fetch').mockImplementation((req) => {
            return new Promise((_, reject) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                req.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
                controller.abort();
            });
        });

        await expect(getArrayBuffer({url: ''}, controller.signal)).rejects.toMatchObject({name: 'AbortError'});
    });

    test('getData XHR path: abort calls xhr.abort() and rejects AbortError', async () => {
        const controller = new AbortController();
        let xhrAborted = false;
        vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
            this.open = () => {};
            this.setRequestHeader = () => {};
            this.send = () => { setTimeout(() => controller.abort(), 0); };
            this.abort = () => { xhrAborted = true; };
        });

        await expect(getData({url: 'file://test'}, controller.signal)).rejects.toMatchObject({name: 'AbortError'});
        expect(xhrAborted).toEqual(true);
    });

    test('getData XHR abort listener removed after normal resolution (no leak)', async () => {
        const controller = new AbortController();
        let listenerCount = 0;
        const origAdd = controller.signal.addEventListener.bind(controller.signal);
        const origRemove = controller.signal.removeEventListener.bind(controller.signal);
        vi.spyOn(controller.signal, 'addEventListener').mockImplementation((type, fn, opts) => {
            if (type === 'abort') listenerCount++;
            origAdd(type, fn, opts);
        });
        vi.spyOn(controller.signal, 'removeEventListener').mockImplementation((type, fn) => {
            if (type === 'abort') listenerCount--;
            origRemove(type, fn);
        });

        vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function () {
            this.open = () => {};
            this.setRequestHeader = () => {};
            this.send = () => {
                setTimeout(() => {
                    this.status = 200;
                    this.response = 'hello';
                    this.getAllResponseHeaders = () => '';
                    this.onload(new Event('load'));
                }, 0);
            };
            this.abort = () => {};
        });

        await getData({url: 'file://test'}, controller.signal);
        expect(listenerCount).toEqual(0);
    });

    test('getJSON parse error rejects with parse error', async () => {
        // eslint-disable-next-line @typescript-eslint/require-await
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response('not json', {status: 200, headers: {'Content-Type': 'application/json'}});
        });

        await expect(getJSON({url: ''})).rejects.toBeInstanceOf(SyntaxError);
    });

    test('getVideo resolves with the video element when onloadstart fires', async () => {
        const video = document.createElement('video');
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            return tag === 'video' ? video : ({} as HTMLSourceElement);
        });
        video.appendChild = vi.fn();

        const promise = getVideo(['https://example.com/video.mp4']);
        video.onloadstart(new Event('loadstart'));

        await expect(promise).resolves.toBe(video);
    });

    test('getVideo rejects with the URLs in the message when onerror fires', async () => {
        const video = document.createElement('video');
        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            return tag === 'video' ? video : ({} as HTMLSourceElement);
        });
        video.appendChild = vi.fn();

        const promise = getVideo(['https://example.com/video.mp4', 'https://example.com/video.webm']);
        video.onerror(new Event('error'));

        await expect(promise).rejects.toThrow('https://example.com/video.mp4, https://example.com/video.webm');
    });
});
