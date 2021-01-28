// @flow

import {warnOnce, parseCacheControl} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';

import type Dispatcher from './dispatcher';

const CACHE_NAME = 'mapbox-glyphs';

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

function cacheURL(fontname: string, id: number): string {
    return `/${fontname}/${id}`;
}

function serialize(glyph: StyleGlyph): Response {
    var formData = new FormData();
    formData.append('id', glyph.id);
    formData.append('metrics', JSON.stringify(glyph.metrics));
    formData.append('width', glyph.bitmap.width);
    formData.append('height', glyph.bitmap.height);
    formData.append('bitmap', new Blob([glyph.bitmap.data.buffer]));
    return new Response(formData);
}

function deserialize(response: Response, callback: (error: ?any, response: ?StyleGlyph) => void): StyleGlyph {
    response.formData().then((formData) => {
        formData.get('bitmap').arrayBuffer().then((bitmap) => {
            callback(null, {
                id: +formData.get('id'),
                metrics: JSON.parse(formData.get('metrics')),
                bitmap: new AlphaImage({
                    width: +formData.get('width'),
                    height: +formData.get('height')
                }, new Uint8Array(bitmap))
            });
        })
    });
}

export function cachePut(fontname: string, glyph: StyleGlyph) {
    cacheOpen();
    if (!sharedCache) return;

    cacheOpen();
    if (!sharedCache) return;
    sharedCache
        .then(cache => cache.put(cacheURL(fontname, glyph.id), serialize(glyph)))
        .catch(e => warnOnce(e.message));
}

export function cacheGet(fontname: string, id: number, callback: (error: ?any, response: ?StyleGlyph) => void) {
    cacheOpen();
    if (!sharedCache) return callback(null);

    sharedCache
        .then(cache => {
            cache.match(cacheURL(fontname, id))
                .then(response => {
                    deserialize(response, callback);
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
