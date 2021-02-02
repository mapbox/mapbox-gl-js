// @flow

import {warnOnce, extend} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';

const CACHE_NAME = 'mapbox-glyphs';
const FONT_FAMILY_NAME = 'font-family';

let db: ?Promise<IDBDatabase>;

const cachedGlyphMap: {[string]: StyleGlyph} = {};
let loadingCallbacks: Array<{key: string, callback: (error: ?any, response: ?StyleGlyph) => void}> = [];
let cacheLoaded: boolean = false;

function loadCache(): void {
    if (!db) return;

    db.then(db => {
        const transaction = db.transaction([CACHE_NAME], "readonly");
        // Flow annotation for IDBObjectStore doesn't include getAll()
        const objectStore: any = transaction.objectStore(CACHE_NAME);
        const request = objectStore.getAll();
        request.onsuccess = () => {
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
        };
        request.onerror = () => {
            cacheLoaded = true;
            loadingCallbacks.forEach(loading => {
                loading.callback(request.error);
            });
            loadingCallbacks = [];
        };
    });
}

export function cacheOpen(fontFamily: string): void {
    if (window.indexedDB && !db) {
        db = new Promise((resolve, reject) => {
            const IDBOpenDBRequest = window.indexedDB.open(CACHE_NAME);
            IDBOpenDBRequest.onsuccess = () => {
                const transaction = IDBOpenDBRequest.result.transaction([CACHE_NAME, FONT_FAMILY_NAME], "readwrite");
                const fontFamilyStore = transaction.objectStore(FONT_FAMILY_NAME);
                const request = fontFamilyStore.get(FONT_FAMILY_NAME);
                request.onsuccess = () => {
                    // If font family has changed, we need to clear the cache
                    if (!request.result || request.result !== fontFamily) {
                        fontFamilyStore.put(fontFamily, FONT_FAMILY_NAME);
                        const glyphStore = transaction.objectStore(CACHE_NAME);
                        const clearRequest = glyphStore.clear();
                        clearRequest.onsuccess = () => {
                            resolve(IDBOpenDBRequest.result);
                        };
                        clearRequest.onerror = () => {
                            reject(request.error);
                        };
                    } else {
                        resolve(IDBOpenDBRequest.result);
                    }
                };

                request.onerror = () => {
                    reject(request.error);
                };
            };
            IDBOpenDBRequest.onupgradeneeded = event =>  {
                const db = event.target.result;

                db.onerror = event => {
                    reject(event);
                };

                db.createObjectStore(CACHE_NAME);
                db.createObjectStore(FONT_FAMILY_NAME);
            };
            IDBOpenDBRequest.onerror = () => {
                reject(IDBOpenDBRequest.error);
            };
        });
        // Start loading everything in the cache as soon as we start up, this gives us
        // a head start on having glyphs ready by the time they're requested.
        loadCache();
    }
}

// We're never closing the cache, but our unit tests rely on changing out the global window.caches
// object, so we have a function specifically for unit tests that allows resetting the shared cache.
export function cacheClose(): void {
    db = undefined;
}

function cacheKey(fontname: string, id: number): string {
    return `${fontname}/${id}`;
}

function delayPut(put: () => void) {
    // Spread out cache writes to avoid blocking foreground
    // Not a big deal if some writes don't get committed before session ends
    if (window.requestIdleCallback) {
        window.requestIdleCallback(put);
    } else {
        setTimeout(put, 5000 + Math.round(Math.random() * 10000));
    }
}

export function cachePut(fontname: string, glyph: StyleGlyph): void {
    if (!db) return;

    delayPut(() => {
        if (!db) return;
        db.then(db => {
            const transaction = db.transaction([CACHE_NAME], "readwrite");
            const objectStore = transaction.objectStore(CACHE_NAME);
            const request = objectStore.put(extend(glyph, {fontname}), cacheKey(fontname, glyph.id));
            request.onerror = () => {
                warnOnce(request.error.toString());
            };
        });
    });
}

export function cacheGet(fontname: string, id: number, callback: (error: ?any, response: ?StyleGlyph) => void): void {
    if (!db || cacheLoaded) {
        callback(null, cachedGlyphMap[cacheKey(fontname, id)]);
    } else {
        loadingCallbacks.push({key: cacheKey(fontname, id), callback});
    }
}
