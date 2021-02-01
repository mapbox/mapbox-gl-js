// @flow

import {warnOnce, parseCacheControl, extend} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';
import parseGlyphPBF from '../style/parse_glyph_pbf';
import writeGlyphPBF from '../style/write_glyph_pbf';

import {SDF_SCALE} from '../render/glyph_manager';

const CACHE_NAME = 'mapbox-glyphs';
const FONT_FAMILY_NAME = 'font-family';

let db;

const cachedGlyphMap = {};
let loadingCallbacks = [];
let cacheLoaded = false;

function loadCache() {
    if (!db) return;

    db.then(db => {
        const transaction = db.transaction([CACHE_NAME], "readonly");
        const objectStore = transaction.objectStore(CACHE_NAME);
        const request = objectStore.getAll();
        request.onsuccess = event => {
            if (request.result) {
                request.result.forEach(glyph => {
                    const {metrics, bitmap, fontname, id} = glyph;
                    cachedGlyphMap[cacheKey(fontname, id)] = {
                        id,
                        metrics,
                        bitmap: new AlphaImage({
                            width: bitmap.width,
                            height: bitmap.height
                        }, bitmap.data)};
                    });
            }
            cacheLoaded = true;
            loadingCallbacks.forEach(loading => {
                loading.callback(null, cachedGlyphMap[loading.key]);
            });
            loadingCallbacks = [];
        }
        request.onerror = event => {
            cacheLoaded = true;
            loadingCallbacks.forEach(loading => {
                loading.callback(request.error);
            });
            loadingCallbacks = [];
        }
    });
}

export function cacheOpen(fontFamily: string) {
    if (window.indexedDB && !db) {
        db = new Promise((resolve, reject) => {
            const IDBOpenDBRequest = window.indexedDB.open(CACHE_NAME);
            IDBOpenDBRequest.onsuccess = event => {
                const transaction = IDBOpenDBRequest.result.transaction([CACHE_NAME, FONT_FAMILY_NAME], "readwrite");
                const fontFamilyStore = transaction.objectStore(FONT_FAMILY_NAME);
                const request = fontFamilyStore.get(FONT_FAMILY_NAME);
                request.onsuccess = event => {
                    // If font family has changed, we need to clear the cache
                    if (!request.result || request.result != fontFamily) {
                        fontFamilyStore.put(fontFamily, FONT_FAMILY_NAME);
                        const glyphStore = transaction.objectStore(CACHE_NAME);
                        const clearRequest = glyphStore.clear();
                        clearRequest.onsuccess = event => {
                            resolve(IDBOpenDBRequest.result);
                        }
                        clearRequest.onerror = event => {
                            reject(request.error);
                        }
                    } else {
                        resolve(IDBOpenDBRequest.result);
                    }
                }

                request.onerror = event => {
                    reject(request.error);
                }
            }
            IDBOpenDBRequest.onupgradeneeded = event =>  {
                var db = event.target.result;

                db.onerror = event => {
                    reject(event);
                };

                db.createObjectStore(CACHE_NAME);
                db.createObjectStore(FONT_FAMILY_NAME);
            };
            IDBOpenDBRequest.onerror = (event) => {
                reject(IDBOpenDBRequest.error);
            }
        });
        db.then(db => {
            // Start loading everything in the cache as soon as we start up, this gives us
            // a head start on having glyphs ready by the time they're requested.
            loadCache();
        });
    }
}

// We're never closing the cache, but our unit tests rely on changing out the global window.caches
// object, so we have a function specifically for unit tests that allows resetting the shared cache.
export function cacheClose() {
    db = undefined;
}

function cacheKey(fontname: string, id: number) {
    return `${fontname}/${id}`;
}

export function cachePut(fontname: string, glyph: StyleGlyph) {
    if (!db) return;

    setTimeout(() => {
        db.then(db => {
            const transaction = db.transaction([CACHE_NAME], "readwrite");
            const objectStore = transaction.objectStore(CACHE_NAME);
            const request = objectStore.put(extend(glyph, {fontname}), cacheKey(fontname, glyph.id));
            request.onsuccess = event => {
            }
            request.onerror = event => {
                warnOnce(request.error);
            }
        });
    // Spread out cache writes to avoid blocking foreground
    // Not a big deal if some writes don't get committed
    }, 5000 + Math.round(Math.random * 10000));
}

export function cacheGet(fontname: string, id: number, callback: (error: ?any, response: ?StyleGlyph) => void) {
    if (cacheLoaded) {
        callback(null, cachedGlyphMap[cacheKey(fontname, id)]);
    } else {
        loadingCallbacks.push({key: cacheKey(fontname, id), callback});
    }
}
