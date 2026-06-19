import config from './config';
import assert from '../style-spec/util/assert';
import webpSupported from './webp_supported';
import {warnOnce, isWorker} from './util';
import {cacheGet, cachePut} from './tile_request_cache';
import {isMapboxHTTPURL, hasCacheDefeatingSku} from './mapbox_url';

/**
 * The type of a resource.
 * @private
 * @readonly
 * @enum {string}
 */
const ResourceType = {
    Unknown: 'Unknown',
    Style: 'Style',
    Source: 'Source',
    Tile: 'Tile',
    Glyphs: 'Glyphs',
    SpriteImage: 'SpriteImage',
    SpriteJSON: 'SpriteJSON',
    Iconset: 'Iconset',
    Image: 'Image',
    Model: 'Model'
} as const;

export {ResourceType};

Object.freeze(ResourceType);

/**
 * A `RequestParameters` object to be returned from Map.options.transformRequest callbacks.
 * @typedef {Object} RequestParameters
 * @property {string} url The URL to be requested.
 * @property {Object} headers The headers to be sent with the request.
 * @property {string} method Request method `'GET' | 'POST' | 'PUT'`.
 * @property {string} body Request body.
 * @property {string} type Response body type to be returned `'string' | 'json' | 'arrayBuffer'`.
 * @property {string} credentials `'same-origin'|'include'` Use 'include' to send cookies with cross-origin requests.
 * @property {boolean} collectResourceTiming If true, Resource Timing API information will be collected for these transformed requests and returned in a resourceTiming property of relevant data events.
 * @property {string} referrerPolicy A string representing the request's referrerPolicy. For more information and possible values, see the [Referrer-Policy HTTP header page](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy).
 * @example
 * // use transformRequest to modify requests that begin with `http://myHost`
 * const map = new Map({
 *     container: 'map',
 *     style: 'mapbox://styles/mapbox/streets-v11',
 *     transformRequest: (url, resourceType) => {
 *         if (resourceType === 'Source' && url.indexOf('http://myHost') > -1) {
 *             return {
 *                 url: url.replace('http', 'https'),
 *                 headers: {'my-custom-header': true},
 *                 credentials: 'include'  // Include cookies for cross-origin requests
 *             };
 *         }
 *     }
 * });
 *
 */
export type RequestParameters = {
    url: string;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST' | 'PUT';
    body?: string;
    type?: 'string' | 'json' | 'arrayBuffer';
    credentials?: 'same-origin' | 'include';
    collectResourceTiming?: boolean;
    referrerPolicy?: ReferrerPolicy;
};

export type ResponseCallback<T> = (
    error?: Error | DOMException | AJAXError | null,
    data?: T | null,
    headers?: Headers
) => void;

type RequestResponse<T> = {data: T; headers: Headers};

export class AJAXError extends Error {
    url: string;
    status: number;
    statusText: string;

    constructor(statusText: string, status: number, url: string) {
        super();
        this.url = url;
        this.statusText = statusText;
        this.status = status;
    }

    override get message(): string {
        return this.status === 401 && isMapboxHTTPURL(this.url) ?
            `${this.statusText}: you may have provided an invalid Mapbox access token. See https://docs.mapbox.com/api/guides/#access-tokens-and-token-scopes` :
            this.statusText;
    }

    override toString(): string {
        return `${this.name}: ${this.message} (${this.status}): ${this.url}`;
    }
}

export function isHttpNotFound(err: Error | AJAXError): boolean {
    return typeof err === 'object' && err !== null && 'status' in err && err.status === 404;
}

// Ensure that we're sending the correct referrer from blob URL worker bundles.
// For files loaded from the local file system, `location.origin` will be set
// to the string(!) "null" (Firefox), or "file://" (Chrome, Safari, Edge, IE),
// and we will set an empty referrer. Otherwise, we're using the document's URL.
export const getReferrer: () => string = isWorker() ?
    () => (self as typeof self & {worker: {referrer: string}}).worker.referrer :
    () => (location.protocol === 'blob:' ? parent : self).location.href;

const PROTOCOL_RE = /^\w+:/;
const NEWLINE_RE = /[\r\n]+/;

// Determines whether a URL is a file:// URL. This is obviously the case if it begins
// with file://. Relative URLs are also file:// URLs iff the original document was loaded
// via a file:// URL.
const isFileURL = (url: string) => url.startsWith('file:') || (getReferrer().startsWith('file:') && !PROTOCOL_RE.test(url));

async function readResponse<T>(requestParameters: RequestParameters, response: Response): Promise<RequestResponse<T>> {
    let data: T;
    if (requestParameters.type === 'arrayBuffer') {
        data = await response.arrayBuffer() as unknown as T;
    } else if (requestParameters.type === 'json') {
        data = await response.json() as T;
    } else {
        data = await response.text() as unknown as T;
    }

    return {data, headers: response.headers};
}

async function makeFetchRequest<T>(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<T>> {
    const request = new Request(requestParameters.url, {
        method: requestParameters.method || 'GET',
        body: requestParameters.body,
        credentials: requestParameters.credentials,
        headers: requestParameters.headers,
        referrer: getReferrer(),
        referrerPolicy: requestParameters.referrerPolicy,
        signal
    });

    const cacheIgnoringSearch = hasCacheDefeatingSku(request.url);

    if (requestParameters.type === 'json') {
        request.headers.set('Accept', 'application/json');
    }

    if (cacheIgnoringSearch) {
        let cached: {response: Response; fresh: boolean} | null = null;
        try {
            cached = await cacheGet(request);
        } catch (err) {
            // HTTP pages in Edge trigger a security error that can be ignored.
            if ((err as Error).message !== 'SecurityError') warnOnce((err as Error).toString());
        }
        if (cached && cached.fresh) {
            if (signal) signal.throwIfAborted();
            return readResponse<T>(requestParameters, cached.response);
        }
    }

    const requestTime = Date.now();
    let fetched: Response;
    try {
        fetched = await fetch(request);
    } catch (err) {
        // Preserve abort as-is so callers can filter it; for genuine network failures keep
        // the request URL in the message, matching the pre-Promise diagnostics.
        if ((err as Error).name === 'AbortError') throw err;
        throw new Error(`${(err as Error).message} ${requestParameters.url}`, {cause: err});
    }

    if (signal) signal.throwIfAborted();
    if (!fetched.ok) throw new AJAXError(fetched.statusText, fetched.status, requestParameters.url);

    // Clone before reading the body; cache the clone after the read completes. Aborting
    // mid-read can crash the cache insertion in Firefox, so the write must follow the full
    // read. Fire-and-forget: it must not block handing data to the renderer.
    const clonedResponse = cacheIgnoringSearch ? fetched.clone() : null;
    const result = await readResponse<T>(requestParameters, fetched);
    if (clonedResponse) {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        cachePut(request, clonedResponse, requestTime);
    }
    return result;
}

async function makeXMLHttpRequest<T>(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<T>> {
    return new Promise<RequestResponse<T>>((resolve, reject) => {
        const xhr: XMLHttpRequest = new XMLHttpRequest();

        const onAbort = () => {
            signal.removeEventListener('abort', onAbort);
            xhr.abort();
            reject(signal.reason as Error);
        };

        if (signal) {
            signal.addEventListener('abort', onAbort);
        }

        xhr.open(requestParameters.method || 'GET', requestParameters.url, true);
        if (requestParameters.type === 'arrayBuffer') {
            xhr.responseType = 'arraybuffer';
        }
        for (const k in requestParameters.headers) {
            xhr.setRequestHeader(k, requestParameters.headers[k]);
        }
        if (requestParameters.type === 'json') {
            xhr.responseType = 'text';
            xhr.setRequestHeader('Accept', 'application/json');
        }
        xhr.withCredentials = requestParameters.credentials === 'include';

        xhr.onerror = () => {
            if (signal) signal.removeEventListener('abort', onAbort);
            reject(new Error(xhr.statusText));
        };

        xhr.onload = () => {
            if (signal) signal.removeEventListener('abort', onAbort);
            if (((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) && xhr.response !== null) {
                let data: unknown = xhr.response;
                if (requestParameters.type === 'json') {
                    // We're manually parsing JSON here to get better error messages.
                    try {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        data = JSON.parse(xhr.response);
                    } catch (err) {
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                        reject(err as Error);
                        return;
                    }
                }
                const headers = new Headers();
                xhr.getAllResponseHeaders().trim().split(NEWLINE_RE).forEach(line => {
                    const parts = line.split(': ');
                    const key = parts.shift();
                    const value = parts.join(': ');
                    if (key) headers.set(key, value);
                });
                resolve({data: data as T, headers});
            } else {
                reject(new AJAXError(xhr.statusText, xhr.status, requestParameters.url));
            }
        };

        xhr.send(requestParameters.body);
    });
}

async function makeRequest<T>(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<T>> {
    if (signal) signal.throwIfAborted();

    if (isFileURL(requestParameters.url)) {
        return makeXMLHttpRequest<T>(requestParameters, signal);
    }

    return makeFetchRequest<T>(requestParameters, signal);
}

export async function getJSON<T = unknown>(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<T>> {
    return makeRequest<T>(Object.assign(requestParameters, {type: 'json'}), signal);
}

export async function getArrayBuffer(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<ArrayBuffer>> {
    return makeRequest<ArrayBuffer>(Object.assign(requestParameters, {type: 'arrayBuffer'}), signal);
}

export async function postData(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<string>> {
    return makeRequest<string>(Object.assign(requestParameters, {method: 'POST'}), signal);
}

export async function getData(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<string>> {
    return makeRequest<string>(Object.assign(requestParameters, {method: 'GET'}), signal);
}

function sameOrigin(url: string) {
    const a: HTMLAnchorElement = document.createElement('a');
    a.href = url;
    return a.protocol === location.protocol && a.host === location.host;
}

// Limit concurrent image loads to help with raster sources performance on big screens.
// See https://github.com/mapbox/mapbox-gl-js/issues/1470.
let imageRequestQueue: Array<() => void>;
let activeImageRequests: number;
export const resetImageRequestQueue = () => {
    imageRequestQueue = [];
    activeImageRequests = 0;
};
resetImageRequestQueue();

function acquireImageRequest(signal?: AbortSignal): Promise<() => void> {
    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            reject(signal.reason as Error);
            return;
        }

        const release = () => {
            assert(activeImageRequests > 0);
            const next = imageRequestQueue.shift();
            if (next) {
                next();
            } else {
                activeImageRequests--;
            }
        };

        if (activeImageRequests < config.MAX_PARALLEL_IMAGE_REQUESTS) {
            activeImageRequests++;
            resolve(release);
            return;
        }

        const dequeue = () => {
            if (signal) signal.removeEventListener('abort', cancel);
            resolve(release);
        };

        const cancel = () => {
            const index = imageRequestQueue.indexOf(dequeue);
            if (index !== -1) imageRequestQueue.splice(index, 1);
            reject(signal.reason as Error);
        };

        if (signal) signal.addEventListener('abort', cancel);
        imageRequestQueue.push(dequeue);
    });
}

export async function getImage(requestParameters: RequestParameters, signal?: AbortSignal): Promise<RequestResponse<ImageBitmap>> {
    if (webpSupported.supported) {
        if (!requestParameters.headers) {
            requestParameters.headers = {};
        }
        requestParameters.headers['accept'] = 'image/webp,*/*';
    }

    const release = await acquireImageRequest(signal);
    try {
        // fetch the image as an ArrayBuffer rather than via an <img> element so it shares the HTTP cache
        const {data, headers} = await getArrayBuffer(requestParameters, signal);
        let bitmap: ImageBitmap;
        try {
            bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], {type: 'image/png'}));
        } catch (e) {
            throw new Error(`Could not load image because of ${(e as Error).message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`, {cause: e});
        }
        // A late-resolving body must not deliver after abort, or it resurrects torn-down ImageSource state.
        if (signal) signal.throwIfAborted();
        return {data: bitmap, headers};
    } finally {
        release();
    }
}

export async function getVideo(urls: Array<string>): Promise<HTMLVideoElement> {
    const video: HTMLVideoElement = document.createElement('video');
    video.muted = true;
    for (const url of urls) {
        const s: HTMLSourceElement = document.createElement('source');
        if (!sameOrigin(url)) {
            video.crossOrigin = 'Anonymous';
        }
        s.src = url;
        video.appendChild(s);
    }

    await new Promise<void>((resolve, reject) => {
        video.onloadstart = () => resolve();
        video.onerror = () => reject(new Error(`Could not load video: ${urls.join(', ')}`));
    });

    return video;
}
