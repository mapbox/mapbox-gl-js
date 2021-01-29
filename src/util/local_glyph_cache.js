// @flow

import {warnOnce, parseCacheControl} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';
import parseGlyphPBF from '../style/parse_glyph_pbf';
import writeGlyphPBF from '../style/write_glyph_pbf';

import {SDF_SCALE} from '../render/glyph_manager';

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

function cacheURL(fontname: string): string {
    return `http://mapbox.com/${fontname}`;
}

function serialize(glyphs: Array<StyleGlyph>): Response {
    return new Response(writeGlyphPBF(glyphs));
}

function _cachePut(fontname: string, glyphs: Array<StyleGlyph>) {
    cacheOpen();
    if (!sharedCache) return;
    sharedCache
        .then(cache => cache.put(cacheURL(fontname), serialize(glyphs)))
        .catch(e => warnOnce(e.message));
}

let lastPut = window.performance.now();

export function cachePut(fontname: string, glyph: StyleGlyph) {
    //return;
    cachedGlyphs[fontname][glyph.id] = glyph;
    if (window.performance.now() - lastPut > 10000) {
        lastPut = window.performance.now();
        for (const fontname of ['400', '500', '900']) {
            _cachePut(fontname, Object.values(cachedGlyphs[fontname]));
        }
    }
}

const cachedGlyphs = { '400': {}, '500': {}, '900': {}};
let cacheLoaded = { '400': false, '500': false, '900': false};
const loadingCallbacks = { '400': [], '500': [], '900': []};

function deserialize(response: Response, fontname: string): void {
    response.arrayBuffer().then((pbf) => {
        console.log(`PBF size: ${pbf.byteLength}`);
        const glyphs = parseGlyphPBF(pbf, SDF_SCALE);
        for (const glyph of glyphs) {
            cachedGlyphs[fontname][glyph.id] = glyph;
        }
        cacheLoaded[fontname] = true;
        for (loadingCallback of loadingCallbacks[fontname]) {
            loadingCallback.callback(null, cachedGlyphs[loadingCallback.id]);
        }
    });
}

function loadCache(fontname) {
    cacheOpen();
    if (sharedCache) {
        sharedCache
            .then(cache => {
                cache.match(cacheURL(fontname))
                    .then(response => {
                        if (response) {
                            deserialize(response, fontname);
                        } else {
                            cacheLoaded[fontname] = true;
                            for (loadingCallback of loadingCallbacks[fontname]) {
                                loadingCallback.callback();
                            }
                        }
                    });
            })
    }
}

loadCache('400');
loadCache('500');
loadCache('900');

export function cacheGet(fontname: string, id: number, callback: (error: ?any, response: ?StyleGlyph) => void) {
    //return callback();
    if (cacheLoaded[fontname]) {
        return callback(null, cachedGlyphs[fontname][id]);
    } else {
        loadingCallbacks[fontname].push({id, callback});
    }
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
