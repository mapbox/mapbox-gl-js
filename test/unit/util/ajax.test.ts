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

    test('getImage resolves with {data: ImageBitmap, headers}', async () => {
        resetImageRequestQueue();

        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            return new window.Response(await getPNGResponse(), {
                status: 200,
                headers: {'Content-Type': 'image/png', 'Cache-Control': 'max-age=100'}
            });
        });

        const {data, headers} = await getImage({url: ''});
        expect(data).toBeInstanceOf(ImageBitmap);
        expect(headers.get('Cache-Control')).toEqual('max-age=100');
    });

    test('getImage rejects with the supported-image-type message on undecodable data', async () => {
        resetImageRequestQueue();

        vi.spyOn(window, 'fetch').mockImplementation(() => Promise.resolve(new window.Response('not an image', {
            status: 200,
            headers: {'Content-Type': 'image/png'}
        })));
        vi.spyOn(window, 'createImageBitmap').mockRejectedValue(new Error('boom'));

        await expect(getImage({url: ''})).rejects.toThrow(/supported image type such as PNG or JPEG/);
    });

    test('getImage respects maxParallelImageRequests', async () => {
        resetImageRequestQueue();

        const requests: Array<any> = [];
        const resolveFetch: Array<(r: Response) => void> = [];
        vi.spyOn(window, 'fetch').mockImplementation((req) => {
            requests.push(req);
            return new Promise<Response>((resolve) => { resolveFetch.push(resolve); });
        });
        // Mock the decode so a settled request releases its slot deterministically within one tick.
        vi.spyOn(window, 'createImageBitmap').mockResolvedValue({} as ImageBitmap);

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const promises: Array<Promise<unknown>> = [];
        for (let i = 0; i < maxRequests + 1; i++) {
            promises.push(getImage({url: ''}).catch(() => {}));
        }

        const waitUntil = async (predicate: () => boolean) => {
            // eslint-disable-next-line no-await-in-loop
            for (let i = 0; i < 50 && !predicate(); i++) await new Promise(r => { setTimeout(r, 0); });
        };

        // only maxRequests reach the network; the extra one is queued behind the throttle
        await new Promise(r => { setTimeout(r, 0); });
        expect(requests.length).toEqual(maxRequests);

        // settle one in-flight request → its freed slot is handed to the queued request, which fetches
        resolveFetch[0](new window.Response('', {
            status: 200,
            headers: {'Content-Type': 'image/png'}
        }));
        await waitUntil(() => requests.length === maxRequests + 1);
        expect(requests.length).toEqual(maxRequests + 1);

        // drain the rest so nothing leaks into the next test
        for (let i = 1; i < resolveFetch.length; i++) {
            resolveFetch[i](new window.Response('', {
                status: 200,
                headers: {'Content-Type': 'image/png'}
            }));
        }
        await Promise.all(promises);
    });

    test('getImage aborting an in-flight request frees a slot for a queued one', async () => {
        resetImageRequestQueue();

        const requests: Array<any> = [];
        const resolveFetch: Array<(r: Response) => void> = [];
        vi.spyOn(window, 'fetch').mockImplementation((req) => {
            requests.push(req);
            return new Promise<Response>((resolve, reject) => {
                resolveFetch.push(resolve);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                req.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            });
        });

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const controllers: Array<AbortController> = [];
        const promises: Array<Promise<unknown>> = [];
        for (let i = 0; i < maxRequests + 1; i++) {
            const controller = new AbortController();
            controllers.push(controller);
            promises.push(getImage({url: ''}, controller.signal).catch(() => {}));
        }

        await new Promise(r => { setTimeout(r, 0); });
        expect(requests.length).toEqual(maxRequests);

        // abort an in-flight request → getArrayBuffer rejects, slot released to the queued request
        controllers[0].abort();
        await new Promise(r => { setTimeout(r, 0); });
        expect(requests.length).toEqual(maxRequests + 1);

        controllers.forEach(c => c.abort());
        await Promise.all(promises);
    });

    test('getImage requests that were once queued are still abortable', async () => {
        resetImageRequestQueue();

        const serverRequests: Array<any> = [];
        const resolveFetch: Array<(r: Response) => void> = [];
        vi.spyOn(window, 'fetch').mockImplementation((req) => {
            serverRequests.push(req);
            return new Promise<Response>((resolve, reject) => {
                resolveFetch.push(resolve);
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                req.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            });
        });

        const maxRequests = config.MAX_PARALLEL_IMAGE_REQUESTS;

        const controllers: Array<AbortController> = [];
        const promises: Array<Promise<unknown>> = [];
        for (let i = 0; i < maxRequests; i++) {
            const controller = new AbortController();
            controllers.push(controller);
            promises.push(getImage({url: ''}, controller.signal).catch(() => {}));
        }

        await new Promise(r => { setTimeout(r, 0); });
        // the limit of allowed requests is reached
        expect(serverRequests.length).toEqual(maxRequests);

        // this request is queued behind the throttle and never reaches the network
        const queuedController = new AbortController();
        const queuedURL = 'this-is-the-queued-request';
        const queued = getImage({url: queuedURL}, queuedController.signal).catch(() => {});

        await new Promise(r => { setTimeout(r, 0); });
        expect(serverRequests.length).toEqual(maxRequests);

        // abort while still queued → it is removed from the queue and never issues a request
        queuedController.abort();
        await new Promise(r => { setTimeout(r, 0); });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        expect(serverRequests.some(r => r.url.includes(queuedURL))).toBe(false);
        await queued;

        // freeing an in-flight slot now goes to nothing queued, but the throttle still admits new work
        controllers.forEach(c => c.abort());
        await Promise.all(promises);
    });

    test('getImage does not deliver when cancelled mid-body-read', async () => {
        // Prep async work first, then drain any in-flight requests leaked by earlier tests before
        // resetting, so the shared queue counter is clean.
        const body = await getPNGResponse();
        await new Promise(r => { setTimeout(r, 0); });
        resetImageRequestQueue();

        // Resolve fetch immediately but hold the body read, so abort() lands in the window after
        // fetch resolved (not surfaced as an AbortError by fetch itself) but before the body
        // completes. getImage must re-check the signal after the await and reject rather than
        // resolve, or it resurrects stale ImageSource state after updateImage/onRemove.
        let resolveBody: () => void;
        vi.spyOn(window, 'fetch').mockImplementation(() => Promise.resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: new Headers({'Content-Type': 'image/png'}),
            arrayBuffer: () => new Promise((resolve) => { resolveBody = () => resolve(body); }),
        }));
        vi.spyOn(window, 'createImageBitmap').mockResolvedValue({} as ImageBitmap);

        const controller = new AbortController();
        const onResolve = vi.fn();
        const onReject = vi.fn();
        getImage({url: ''}, controller.signal).then(onResolve, onReject);

        // Let the chain advance into the held body read.
        await new Promise(r => { setTimeout(r, 0); });
        expect(typeof resolveBody).toBe('function');

        controller.abort();
        resolveBody();

        await new Promise(r => { setTimeout(r, 0); });

        expect(onResolve).not.toHaveBeenCalled();
        expect(onReject).toHaveBeenCalledTimes(1);
        expect(onReject.mock.calls[0][0]).toMatchObject({name: 'AbortError'});
    });

    test('getImage sends accept/webp when supported', async () => {
        resetImageRequestQueue();

        await new Promise<void>(resolve => {
            vi.spyOn(window, 'fetch').mockImplementation((req) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                expect(req.headers.get('accept').includes('image/webp')).toBeTruthy();
                resolve();
                return new Promise<Response>(() => {});
            });

            webpSupported.supported = true;

            getImage({url: ''}).catch(() => {});
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
