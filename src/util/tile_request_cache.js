// @flow

import { parseCacheControl } from './util';
import window from './window';

const CACHE_NAME = 'mapbox-tiles';
const CACHE_LIMIT = 50;

export type ResponseOptions = {
    status: number,
    statusText: string,
    headers: window.Headers
};

export function cachePut(request, response, cacheHeaders, requestTime) {
    if (!window.caches) return;
    console.log('put');

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
        options.headers.set('Expires', new Date(requestTime + cacheControl['max-age'] * 1000).toUTCString())
        console.log(options.headers.get('Expires'));
    }

    const clonedResponse = new window.Response(response.clone().body, options);

    window.caches.open(CACHE_NAME)
        .then(cache => {
            cache.put(request, clonedResponse).then(() => {
            });
        });
}

export function cacheGet(request, callback) {
    if (!window.caches) return callback(null);

    window.caches.open(CACHE_NAME)
        .catch(callback)
        .then(cache => {
            cache.match(request, { ignoreSearch: true })
                .catch(callback)
                .then(response => {
                    const fresh = isFresh(response);

                    // reinsert into cache so 
                    if (fresh) cache.put(request, response.clone());

                    callback(null, response, fresh);
                });
        });
}



function isFresh(response) {
    if (!response) return false;
    const expires = new Date(response.headers.get('Expires'));
    const cacheControl = parseCacheControl(response.headers.get('Cache-Control') || '');
    return expires > Date.now() && !cacheControl['no-cache'];
}


const CACHE_CHECK_THRESHOLD = 2;
let globalEntryCounter = 0;

export function cacheEntryPossiblyAdded(dispatcher: Dispatcher) {
    globalEntryCounter++;
    if (globalEntryCounter > CACHE_CHECK_THRESHOLD) {
        dispatcher.send('enforceCacheSizeLimit');
    }
}

export function enforceCacheSizeLimit() {
    window.caches.open(CACHE_NAME)
        .then(cache => {
            cache.keys().then(keys => {
                for (let i = 0; i < keys.length - CACHE_LIMIT; i++) {
                    cache.delete(keys[i]);
                }
            })
        });
}

export function clear(callback) {
    window.caches.delete(CACHE_NAME)
        .catch(callback)
        .then(() => callback());
}
