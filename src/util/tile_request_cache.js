// @flow

import {warnOnce, parseCacheControl} from './util.js';
import window from './window.js';

import type Dispatcher from './dispatcher.js';

const CACHE_NAME = 'mapbox-tiles';
let cacheLimit = 500; // 50MB / (100KB/tile) ~= 500 tiles
let cacheCheckThreshold = 50;

const MIN_TIME_UNTIL_EXPIRY = 1000 * 60 * 7; // 7 minutes. Skip caching tiles with a short enough max age.

export type ResponseOptions = {
    status: number,
    statusText: string,
    headers: Headers
};

// We're using a global shared cache object. Normally, requesting ad-hoc Cache objects is fine, but
// Safari has a memory leak in which it fails to release memory when requesting keys() from a Cache
// object. See https://bugs.webkit.org/show_bug.cgi?id=203991 for more information.
let sharedCaches = {};

function getCacheName(url: string) {
    const queryParams = getQueryParameters(url);
    let language;
    let worldview;

    if (queryParams) {
        queryParams.forEach(param => {
            const entry = param.split('=');
            if (entry[0] === 'language') {
                language = entry[1];
            } else if (entry[0] === 'worldview') {
                worldview = entry[1];
            }
        });
    }

    let cacheName = CACHE_NAME;
    if (language) cacheName += `-${language}`;
    if (worldview) cacheName += `-${worldview}`;
    return cacheName;
}

function cacheOpen(cacheName: string) {
    if (window.caches && !sharedCaches[cacheName]) {
        sharedCaches[cacheName] = window.caches.open(cacheName);
    }
}

// We're never closing the cache, but our unit tests rely on changing out the global window.caches
// object, so we have a function specifically for unit tests that allows resetting the shared cache.
export function cacheClose() {
    sharedCaches = {};
}

let responseConstructorSupportsReadableStream;
function prepareBody(response: Response, callback) {
    if (responseConstructorSupportsReadableStream === undefined) {
        try {
            new Response(new ReadableStream()); // eslint-disable-line no-undef
            responseConstructorSupportsReadableStream = true;
        } catch (e) {
            // Edge
            responseConstructorSupportsReadableStream = false;
        }
    }

    if (responseConstructorSupportsReadableStream) {
        callback(response.body);
    } else {
        response.blob().then(callback);
    }
}

export function cachePut(request: Request, response: Response, requestTime: number) {
    const cacheName = getCacheName(request.url);
    cacheOpen(cacheName);
    if (!sharedCaches[cacheName]) return;

    const options: ResponseOptions = {
        status: response.status,
        statusText: response.statusText,
        headers: new window.Headers()
    };
    response.headers.forEach((v, k) => options.headers.set(k, v));

    const cacheControl = parseCacheControl(response.headers.get('Cache-Control') || '');
    if (cacheControl['no-store']) {
        return;
    }
    if (cacheControl['max-age']) {
        options.headers.set('Expires', new Date(requestTime + cacheControl['max-age'] * 1000).toUTCString());
    }

    const expires = options.headers.get('Expires');
    if (!expires) return;
    const timeUntilExpiry = new Date(expires).getTime() - requestTime;
    if (timeUntilExpiry < MIN_TIME_UNTIL_EXPIRY) return;

    prepareBody(response, body => {
        const clonedResponse = new window.Response(body, options);

        cacheOpen(cacheName);
        if (!sharedCaches[cacheName]) return;
        sharedCaches[cacheName]
            .then(cache => cache.put(stripQueryParameters(request.url), clonedResponse))
            .catch(e => warnOnce(e.message));
    });
}

function getQueryParameters(url: string) {
    const paramStart = url.indexOf('?');
    return paramStart > 0 ? url.slice(paramStart + 1).split('&') : [];
}

function stripQueryParameters(url: string) {
    const start = url.indexOf('?');

    if (start < 0) return url;

    const params = getQueryParameters(url);
    const filteredParams = params.filter(param => {
        const entry = param.split('=');
        return entry[0] === 'language' || entry[0] === 'worldview';
    });

    if (filteredParams.length) {
        return `${url.slice(0, start)}?${filteredParams.join('&')}`;
    }

    return url.slice(0, start);
}

export function cacheGet(request: Request, callback: (error: ?any, response: ?Response, fresh: ?boolean) => void): void {
    const cacheName = getCacheName(request.url);
    cacheOpen(cacheName);
    if (!sharedCaches[cacheName]) return callback(null);

    const strippedURL = stripQueryParameters(request.url);

    sharedCaches[cacheName]
        .then(cache => {
            // manually strip URL instead of `ignoreSearch: true` because of a known
            // performance issue in Chrome https://github.com/mapbox/mapbox-gl-js/issues/8431
            cache.match(strippedURL)
                .then(response => {
                    const fresh = isFresh(response);

                    // Reinsert into cache so that order of keys in the cache is the order of access.
                    // This line makes the cache a LRU instead of a FIFO cache.
                    cache.delete(strippedURL);
                    if (fresh) {
                        cache.put(strippedURL, response.clone());
                    }

                    callback(null, response, fresh);
                })
                .catch(callback);
        })
        .catch(callback);

}

function isFresh(response) {
    if (!response) return false;
    const expires = new Date(response.headers.get('Expires') || 0);
    const cacheControl = parseCacheControl(response.headers.get('Cache-Control') || '');
    return expires > Date.now() && !cacheControl['no-cache'];
}

// `Infinity` triggers a cache check after the first tile is loaded
// so that a check is run at least once on each page load.
let globalEntryCounter = Infinity;

// The cache check gets run on a worker. The reason for this is that
// profiling sometimes shows this as taking up significant time on the
// thread it gets called from. And sometimes it doesn't. It *may* be
// fine to run this on the main thread but out of caution this is being
// dispatched on a worker. This can be investigated further in the future.
export function cacheEntryPossiblyAdded(dispatcher: Dispatcher) {
    globalEntryCounter++;
    if (globalEntryCounter > cacheCheckThreshold) {
        dispatcher.getActor().send('enforceCacheSizeLimit', cacheLimit);
        globalEntryCounter = 0;
    }
}

// runs on worker, see above comment
export function enforceCacheSizeLimit(limit: number) {
    for (const sharedCache in sharedCaches) {
        cacheOpen(sharedCache);

        sharedCaches[sharedCache].then(cache => {
            cache.keys().then(keys => {
                for (let i = 0; i < keys.length - limit; i++) {
                    cache.delete(keys[i]);
                }
            });
        });
    }
}

export function clearTileCache(callback?: (err: ?Error) => void) {
    const promises = [];
    for (const cache in sharedCaches) {
        promises.push(window.caches.delete(cache));
        delete sharedCaches[cache];
    }

    if (callback) {
        Promise.all(promises).catch(callback).then(() => callback());
    }
}

export function setCacheLimits(limit: number, checkThreshold: number) {
    cacheLimit = limit;
    cacheCheckThreshold = checkThreshold;
}
