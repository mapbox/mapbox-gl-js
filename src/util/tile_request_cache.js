// @flow

import {warnOnce, parseCacheControl} from './util';
import window from './window';

import type Dispatcher from './dispatcher';

const CACHE_NAME = 'mapbox-tiles';
let cacheLimit = 500; // 50MB / (100KB/tile) ~= 500 tiles
let cacheCheckThreshold = 50;

const MIN_TIME_UNTIL_EXPIRY = 1000 * 60 * 7; // 7 minutes. Skip caching tiles with a short enough max age.

export type ResponseOptions = {
    status: number,
    statusText: string,
    headers: window.Headers
};

// We're using a global shared cache object. Normally, requesting ad-hoc Cache objects is fine, but
// Safari has a memory leak in which it fails to release memory when requesting keys() from a Cache
// object. See https://bugs.webkit.org/show_bug.cgi?id=203991 for more information.
let sharedCache: ?Promise<Cache>;

function cacheOpen() {
    if (window.caches && !sharedCache) {
        sharedCache = window.caches.open(CACHE_NAME);
    }
}

// We're never closing the cache, but our unit tests rely on changing out the global window.caches
// object, so we have a function specifically for unit tests that allows resetting the shared cache.
export function cacheClose() {
    sharedCache = undefined;
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
    cacheOpen();
    if (!sharedCache) return;

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

    const timeUntilExpiry = new Date(options.headers.get('Expires')).getTime() - requestTime;
    if (timeUntilExpiry < MIN_TIME_UNTIL_EXPIRY) return;

    prepareBody(response, body => {
        const clonedResponse = new window.Response(body, options);

        cacheOpen();
        if (!sharedCache) return;
        sharedCache
            .then(cache => cache.put(stripQueryParameters(request.url), clonedResponse))
            .catch(e => warnOnce(e.message));
    });
}

function stripQueryParameters(url: string) {
    const start = url.indexOf('?');
    return start < 0 ? url : url.slice(0, start);
}

export function cacheGet(request: Request, callback: (error: ?any, response: ?Response, fresh: ?boolean) => void) {
    cacheOpen();
    if (!sharedCache) return callback(null);

    const strippedURL = stripQueryParameters(request.url);

    sharedCache
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
    cacheOpen();
    if (!sharedCache) return;

    sharedCache
        .then(cache => {
            cache.keys().then(keys => {
                for (let i = 0; i < keys.length - limit; i++) {
                    cache.delete(keys[i]);
                }
            });
        });
}

export function clearTileCache(callback?: (err: ?Error) => void) {
    const promise = window.caches.delete(CACHE_NAME);
    if (callback) {
        promise.catch(callback).then(() => callback());
    }
}

export function setCacheLimits(limit: number, checkThreshold: number) {
    cacheLimit = limit;
    cacheCheckThreshold = checkThreshold;
}
