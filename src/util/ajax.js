// @flow

import window from './window.js';
import {extend, warnOnce, isWorker} from './util.js';
import {isMapboxHTTPURL, hasCacheDefeatingSku} from './mapbox.js';
import config from './config.js';
import assert from 'assert';
import {cacheGet, cachePut} from './tile_request_cache.js';
import webpSupported from './webp_supported.js';

import type {Callback} from '../types/callback.js';
import type {Cancelable} from '../types/cancelable.js';

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
    Image: 'Image'
};
export {ResourceType};

if (typeof Object.freeze == 'function') {
    Object.freeze(ResourceType);
}

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
    url: string,
    headers?: Object,
    method?: 'GET' | 'POST' | 'PUT',
    body?: string,
    type?: 'string' | 'json' | 'arrayBuffer',
    credentials?: 'same-origin' | 'include',
    collectResourceTiming?: boolean
};

export type ResponseCallback<T> = (error: ?Error, data: ?T, cacheControl: ?string, expires: ?string) => void;

export class AJAXError extends Error {
    status: number;
    url: string;
    constructor(message: string, status: number, url: string) {
        if (status === 401 && isMapboxHTTPURL(url)) {
            message += ': you may have provided an invalid Mapbox access token. See https://docs.mapbox.com/api/overview/#access-tokens-and-token-scopes';
        }
        super(message);
        this.status = status;
        this.url = url;
    }

    toString(): string {
        return `${this.name}: ${this.message} (${this.status}): ${this.url}`;
    }
}

// Ensure that we're sending the correct referrer from blob URL worker bundles.
// For files loaded from the local file system, `location.origin` will be set
// to the string(!) "null" (Firefox), or "file://" (Chrome, Safari, Edge, IE),
// and we will set an empty referrer. Otherwise, we're using the document's URL.
/* global self */
export const getReferrer: (() => string) = isWorker() ?
    () => self.worker && self.worker.referrer :
    () => (window.location.protocol === 'blob:' ? window.parent : window).location.href;

// Determines whether a URL is a file:// URL. This is obviously the case if it begins
// with file://. Relative URLs are also file:// URLs iff the original document was loaded
// via a file:// URL.
const isFileURL = url => /^file:/.test(url) || (/^file:/.test(getReferrer()) && !/^\w+:/.test(url));

function makeFetchRequest(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    const controller = new window.AbortController();
    const request = new window.Request(requestParameters.url, {
        method: requestParameters.method || 'GET',
        body: requestParameters.body,
        credentials: requestParameters.credentials,
        headers: requestParameters.headers,
        referrer: getReferrer(),
        signal: controller.signal
    });
    let complete = false;
    let aborted = false;

    const cacheIgnoringSearch = hasCacheDefeatingSku(request.url);

    if (requestParameters.type === 'json') {
        request.headers.set('Accept', 'application/json');
    }

    const validateOrFetch = (err, cachedResponse, responseIsFresh) => {
        if (aborted) return;

        if (err) {
            // Do fetch in case of cache error.
            // HTTP pages in Edge trigger a security error that can be ignored.
            if (err.message !== 'SecurityError') {
                warnOnce(err);
            }
        }

        if (cachedResponse && responseIsFresh) {
            return finishRequest(cachedResponse);
        }

        if (cachedResponse) {
            // We can't do revalidation with 'If-None-Match' because then the
            // request doesn't have simple cors headers.
        }

        const requestTime = Date.now();

        window.fetch(request).then(response => {
            if (response.ok) {
                const cacheableResponse = cacheIgnoringSearch ? response.clone() : null;
                return finishRequest(response, cacheableResponse, requestTime);
            } else {
                return callback(new AJAXError(response.statusText, response.status, requestParameters.url));
            }
        }).catch(error => {
            if (error.name === 'AbortError') {
                // silence expected AbortError
                return;
            }
            callback(new Error(`${error.message} ${requestParameters.url}`));
        });
    };

    const finishRequest = (response, cacheableResponse, requestTime) => {
        (
            requestParameters.type === 'arrayBuffer' ? response.arrayBuffer() :
            requestParameters.type === 'json' ? response.json() :
            response.text()
        ).then(result => {
            if (aborted) return;
            if (cacheableResponse && requestTime) {
                // The response needs to be inserted into the cache after it has completely loaded.
                // Until it is fully loaded there is a chance it will be aborted. Aborting while
                // reading the body can cause the cache insertion to error. We could catch this error
                // in most browsers but in Firefox it seems to sometimes crash the tab. Adding
                // it to the cache here avoids that error.
                cachePut(request, cacheableResponse, requestTime);
            }
            complete = true;
            callback(null, result, response.headers.get('Cache-Control'), response.headers.get('Expires'));
        }).catch(err => {
            if (!aborted) callback(new Error(err.message));
        });
    };

    if (cacheIgnoringSearch) {
        cacheGet(request, validateOrFetch);
    } else {
        validateOrFetch(null, null);
    }

    return {cancel: () => {
        aborted = true;
        if (!complete) controller.abort();
    }};
}

function makeXMLHttpRequest(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    const xhr: XMLHttpRequest = new window.XMLHttpRequest();

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
        callback(new Error(xhr.statusText));
    };
    xhr.onload = () => {
        if (((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) && xhr.response !== null) {
            let data: mixed = xhr.response;
            if (requestParameters.type === 'json') {
                // We're manually parsing JSON here to get better error messages.
                try {
                    data = JSON.parse(xhr.response);
                } catch (err) {
                    return callback(err);
                }
            }
            callback(null, data, xhr.getResponseHeader('Cache-Control'), xhr.getResponseHeader('Expires'));
        } else {
            callback(new AJAXError(xhr.statusText, xhr.status, requestParameters.url));
        }
    };
    xhr.send(requestParameters.body);
    return {cancel: () => xhr.abort()};
}

export const makeRequest = function(requestParameters: RequestParameters, callback: ResponseCallback<any>): Cancelable {
    // We're trying to use the Fetch API if possible. However, in some situations we can't use it:
    // - Safari exposes window.AbortController, but it doesn't work actually abort any requests in
    //   older versions (see https://bugs.webkit.org/show_bug.cgi?id=174980#c2). In this case,
    //   we dispatch the request to the main thread so that we can get an accurate referrer header.
    // - Requests for resources with the file:// URI scheme don't work with the Fetch API either. In
    //   this case we unconditionally use XHR on the current thread since referrers don't matter.
    if (!isFileURL(requestParameters.url)) {
        if (window.fetch && window.Request && window.AbortController && window.Request.prototype.hasOwnProperty('signal')) {
            return makeFetchRequest(requestParameters, callback);
        }
        if (isWorker() && self.worker && self.worker.actor) {
            const queueOnMainThread = true;
            return self.worker.actor.send('getResource', requestParameters, callback, undefined, queueOnMainThread);
        }
    }
    return makeXMLHttpRequest(requestParameters, callback);
};

export const getJSON = function(requestParameters: RequestParameters, callback: ResponseCallback<Object>): Cancelable {
    return makeRequest(extend(requestParameters, {type: 'json'}), callback);
};

export const getArrayBuffer = function(requestParameters: RequestParameters, callback: ResponseCallback<ArrayBuffer>): Cancelable {
    return makeRequest(extend(requestParameters, {type: 'arrayBuffer'}), callback);
};

export const postData = function(requestParameters: RequestParameters, callback: ResponseCallback<string>): Cancelable {
    return makeRequest(extend(requestParameters, {method: 'POST'}), callback);
};

export const getData = function(requestParameters: RequestParameters, callback: ResponseCallback<string>): Cancelable {
    return makeRequest(extend(requestParameters, {method: 'GET'}), callback);
};

function sameOrigin(url) {
    const a: HTMLAnchorElement = window.document.createElement('a');
    a.href = url;
    return a.protocol === window.document.location.protocol && a.host === window.document.location.host;
}

const transparentPngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';

function arrayBufferToImage(data: ArrayBuffer, callback: Callback<HTMLImageElement>) {
    const img: HTMLImageElement = new window.Image();
    const URL = window.URL;
    img.onload = () => {
        callback(null, img);
        URL.revokeObjectURL(img.src);
        // prevent image dataURI memory leak in Safari;
        // but don't free the image immediately because it might be uploaded in the next frame
        // https://github.com/mapbox/mapbox-gl-js/issues/10226
        img.onload = null;
        window.requestAnimationFrame(() => { img.src = transparentPngUrl; });
    };
    img.onerror = () => callback(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
    const blob: Blob = new window.Blob([new Uint8Array(data)], {type: 'image/png'});
    img.src = data.byteLength ? URL.createObjectURL(blob) : transparentPngUrl;
}

function arrayBufferToImageBitmap(data: ArrayBuffer, callback: Callback<ImageBitmap>) {
    const blob: Blob = new window.Blob([new Uint8Array(data)], {type: 'image/png'});
    window.createImageBitmap(blob).then((imgBitmap) => {
        callback(null, imgBitmap);
    }).catch((e) => {
        callback(new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`));
    });
}

let imageQueue, numImageRequests;
export const resetImageRequestQueue = () => {
    imageQueue = [];
    numImageRequests = 0;
};
resetImageRequestQueue();

export const getImage = function(requestParameters: RequestParameters, callback: ResponseCallback<HTMLImageElement | ImageBitmap>): Cancelable {
    if (webpSupported.supported) {
        if (!requestParameters.headers) {
            requestParameters.headers = {};
        }
        requestParameters.headers.accept = 'image/webp,*/*';
    }

    // limit concurrent image loads to help with raster sources performance on big screens
    if (numImageRequests >= config.MAX_PARALLEL_IMAGE_REQUESTS) {
        const queued = {
            requestParameters,
            callback,
            cancelled: false,
            cancel() { this.cancelled = true; }
        };
        imageQueue.push(queued);
        return queued;
    }
    numImageRequests++;

    let advanced = false;
    const advanceImageRequestQueue = () => {
        if (advanced) return;
        advanced = true;
        numImageRequests--;
        assert(numImageRequests >= 0);
        while (imageQueue.length && numImageRequests < config.MAX_PARALLEL_IMAGE_REQUESTS) { // eslint-disable-line
            const request = imageQueue.shift();
            const {requestParameters, callback, cancelled} = request;
            if (!cancelled) {
                request.cancel = getImage(requestParameters, callback).cancel;
            }
        }
    };

    // request the image with XHR to work around caching issues
    // see https://github.com/mapbox/mapbox-gl-js/issues/1470
    const request = getArrayBuffer(requestParameters, (err: ?Error, data: ?ArrayBuffer, cacheControl: ?string, expires: ?string) => {

        advanceImageRequestQueue();

        if (err) {
            callback(err);
        } else if (data) {
            if (window.createImageBitmap) {
                arrayBufferToImageBitmap(data, (err, imgBitmap) => callback(err, imgBitmap, cacheControl, expires));
            } else {
                arrayBufferToImage(data, (err, img) => callback(err, img, cacheControl, expires));
            }
        }
    });

    return {
        cancel: () => {
            request.cancel();
            advanceImageRequestQueue();
        }
    };
};

export const getVideo = function(urls: Array<string>, callback: Callback<HTMLVideoElement>): Cancelable {
    const video: HTMLVideoElement = window.document.createElement('video');
    video.muted = true;
    video.onloadstart = function() {
        callback(null, video);
    };
    for (let i = 0; i < urls.length; i++) {
        const s: HTMLSourceElement = window.document.createElement('source');
        if (!sameOrigin(urls[i])) {
            video.crossOrigin = 'Anonymous';
        }
        s.src = urls[i];
        video.appendChild(s);
    }
    return {cancel: () => {}};
};
