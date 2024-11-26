import {warnOnce, parseCacheControl} from './util';
import {stripQueryParameters, setQueryParameters} from './url';

import type Dispatcher from './dispatcher';

const CACHE_NAME = 'mapbox-tiles';
let cacheLimit = 500; // 50MB / (100KB/tile) ~= 500 tiles
let cacheCheckThreshold = 50;

const MIN_TIME_UNTIL_EXPIRY = 1000 * 60 * 7; // 7 minutes. Skip caching tiles with a short enough max age.

// So that caching functions correctly, these params are persisted
// on URLs with query params otherwise stripped.
const PERSISTENT_PARAMS = ['language', 'worldview', 'jobid'];

export type ResponseOptions = {
    status: number;
    statusText: string;
    headers: Headers;
};

// We're using a global shared cache object. Normally, requesting ad-hoc Cache objects is fine, but
// Safari has a memory leak in which it fails to release memory when requesting keys() from a Cache
// object. See https://bugs.webkit.org/show_bug.cgi?id=203991 for more information.
let sharedCache: Promise<Cache> | null | undefined;

function getCaches() {
    try {
        return caches;
    } catch (e: any) {
        // <iframe sandbox> triggers exceptions when trying to access window.caches
        // Chrome: DOMException, Safari: SecurityError, Firefox: NS_ERROR_FAILURE
        // Seems more robust to catch all exceptions instead of trying to match only these.
    }
}

function cacheOpen() {
    const caches = getCaches();
    if (caches && sharedCache == null) {
        sharedCache = caches.open(CACHE_NAME);
    }
}

// We're never closing the cache, but our unit tests rely on changing out the global window.caches
// object, so we have a function specifically for unit tests that allows resetting the shared cache.
export function cacheClose() {
    sharedCache = undefined;
}

let responseConstructorSupportsReadableStream;
function prepareBody(response: Response, callback: (body?: Blob | ReadableStream | null) => void) {
    if (responseConstructorSupportsReadableStream === undefined) {
        try {
            new Response(new ReadableStream()); // eslint-disable-line no-undef
            responseConstructorSupportsReadableStream = true;
        } catch (e: any) {
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

// https://fetch.spec.whatwg.org/#null-body-status
function isNullBodyStatus(status: Response["status"]): boolean {
    if (status === 200 || status === 404) {
        return false;
    }

    return [101, 103, 204, 205, 304].includes(status);
}

export function cachePut(request: Request, response: Response, requestTime: number) {
    cacheOpen();
    if (sharedCache == null) return;

    const cacheControl = parseCacheControl(response.headers.get('Cache-Control') || '');
    if (cacheControl['no-store']) return;

    const options: ResponseOptions = {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers()
    };

    response.headers.forEach((v, k) => options.headers.set(k, v));

    if (cacheControl['max-age']) {
        options.headers.set('Expires', new Date(requestTime + cacheControl['max-age'] * 1000).toUTCString());
    }

    const expires = options.headers.get('Expires');
    if (!expires) return;

    const timeUntilExpiry = new Date(expires).getTime() - requestTime;
    if (timeUntilExpiry < MIN_TIME_UNTIL_EXPIRY) return;

    let strippedURL = stripQueryParameters(request.url, {persistentParams: PERSISTENT_PARAMS});

    // Handle partial responses by keeping the range header in the query string
    if (response.status === 206) {
        const range = request.headers.get('Range');
        if (!range) return;

        options.status = 200;
        strippedURL = setQueryParameters(strippedURL, {range});
    }

    prepareBody(response, body => {
        const clonedResponse = new Response(isNullBodyStatus(response.status) ? null : body, options);

        cacheOpen();
        if (sharedCache == null) return;
        sharedCache
            .then(cache => cache.put(strippedURL, clonedResponse))
            .catch(e => warnOnce(e.message));
    });
}

export function cacheGet(
    request: Request,
    callback: (error?: Error, response?: Response, fresh?: boolean) => void,
): void {
    cacheOpen();
    if (sharedCache == null) return callback(null);

    sharedCache
        .then(cache => {
            let strippedURL = stripQueryParameters(request.url, {persistentParams: PERSISTENT_PARAMS});

            const range = request.headers.get('Range');
            if (range) strippedURL = setQueryParameters(strippedURL, {range});

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

function isFresh(response: Response) {
    if (!response) return false;
    const expires = new Date(response.headers.get('Expires') || 0);
    const cacheControl = parseCacheControl(response.headers.get('Cache-Control') || '');
    // @ts-expect-error - TS2365 - Operator '>' cannot be applied to types 'Date' and 'number'.
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
    if (sharedCache == null) return;

    sharedCache
        .then(cache => {
            cache.keys().then(keys => {
                for (let i = 0; i < keys.length - limit; i++) {
                    cache.delete(keys[i]);
                }
            });
        });
}

export function clearTileCache(callback?: (err?: Error | null) => void) {
    const caches = getCaches();
    if (!caches) return;

    const promise = caches.delete(CACHE_NAME);
    if (callback) {
        promise.catch(callback).then(() => callback());
    }
}

export function setCacheLimits(limit: number, checkThreshold: number) {
    cacheLimit = limit;
    cacheCheckThreshold = checkThreshold;
}
