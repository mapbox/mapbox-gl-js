// @flow

import {warnOnce, extend} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';

const CACHE_NAME = 'mapbox-glyphs';
const GLYPHS_OBJECT_STORE = 'glyphs';
const ACCESS_OBJECT_STORE = 'access-times';

let db: ?Promise<IDBDatabase>;
let fontFamily: ?string;

const cachedGlyphMap: {[string]: StyleGlyph} = {};
let loadingCallbacks: Array<{key: string, callback: (error: ?any, response: ?StyleGlyph) => void}> = [];
let cacheLoaded: boolean = false;

function onCacheLoaded(error: ?any): void {
    cacheLoaded = true;
    loadingCallbacks.forEach(loading => {
        loading.callback(error, cachedGlyphMap[loading.key]);
    });
    loadingCallbacks = [];
    if (error) {
        db = undefined; // Prevents further gets/puts
    }
}

function errorFromEvent(event) {
    warnOnce(event.target.error);
}


function loadCache(): void {
    if (!db) return;

    db.then(db => {
        const transaction = db.transaction([GLYPHS_OBJECT_STORE], "readonly");
        // Flow annotation for IDBObjectStore doesn't include getAll()
        const objectStore: any = transaction.objectStore(GLYPHS_OBJECT_STORE);
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
            onCacheLoaded();
        };
        request.onerror = () => {
            onCacheLoaded(request.error);
        };
    }).catch(error => {
        onCacheLoaded(error);
    });
}

export function cacheOpen(sessionFontFamily: string): void {
    fontFamily = sessionFontFamily;
    if (window.indexedDB && !db) {
        db = new Promise((resolve, reject) => {
            const IDBOpenDBRequest = window.indexedDB.open(CACHE_NAME);
            IDBOpenDBRequest.onsuccess = () => {
                IDBOpenDBRequest.result.onversionchange = () => {
                    warnOnce("Closing glyph cache connection because database is being upgraded in another tab.");
                    db = undefined; // Prevents further gets/puts
                    IDBOpenDBRequest.result.close();
                };
                resolve(IDBOpenDBRequest.result);
            };
            IDBOpenDBRequest.onupgradeneeded = event =>  {
                // If a schema change is necessary, consider switching to a new
                // cache name. All of the maps for a website share the same glyph
                // cache, but if only one of them upgrades to a GL JS with a new
                // cache version, all the others will be locked out of the cache.
                const db = event.target.result;

                db.onerror = event => {
                    reject(event);
                };

                for (const name of db.objectStoreNames) {
                    db.deleteObjectStore(name);
                }
                db.createObjectStore(GLYPHS_OBJECT_STORE);
                const accessObjectStore = db.createObjectStore(ACCESS_OBJECT_STORE);
                accessObjectStore.createIndex("accessTime", "accessTime", { unique: false });
            };
            IDBOpenDBRequest.onerror = () => {
                reject(IDBOpenDBRequest.error);
            };

            IDBOpenDBRequest.onblocked = () => {
                // The open request _can_ still succeed, but since we don't know when
                // it might be unblocked, it's safer to try to reject and run
                // without the cache.
                reject(new Error("Local glyph cache can't open because an upgrade is required and another tab is keeping an old version open."));
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
    return `${fontFamily}/${fontname}/${id}`;
}

function accessTime() {
    return { accessTime: Math.round(new Date().getTime() / 1000) };
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
            const transaction = db.transaction(
                [GLYPHS_OBJECT_STORE, ACCESS_OBJECT_STORE], "readwrite");
            transaction.objectStore(GLYPHS_OBJECT_STORE)
                .put(extend(glyph, {fontname}), cacheKey(fontname, glyph.id))
                .onerror = errorFromEvent;

            transaction.objectStore(ACCESS_OBJECT_STORE)
                .put(accessTime(), cacheKey(fontname, glyph.id))
                .onerror = errorFromEvent;
        });
    });
}


export function cacheMarkUsed(fontname: string, id: number): void {
    if (!db) return;

    delayPut(() => {
        if (!db) return;
        db.then(db => {
            const transaction = db.transaction([ACCESS_OBJECT_STORE], "readwrite");
            transaction.objectStore(ACCESS_OBJECT_STORE)
                .put(accessTime(), cacheKey(fontname, id))
                .onerror = errorFromEvent;
        });
    });
}

const CACHE_LIMIT = 4000;

export function cleanCache(): void {
    if (!db) return;

    delayPut(() => {
        if (!db) return;
        db.then(db => {
            // Note we could do the count as a "readonly" transaction and then
            // escalate to "readwrite", with only downside being potential for two
            // maps to double-clean. We stick with a single "readwrite" transaction
            // just because it's simpler and this is a write-heavy database so
            // it shouldn't make much of a difference for contention.
            console.log("Queue clean transaction");
            const transaction = db.transaction(
                [ACCESS_OBJECT_STORE, GLYPHS_OBJECT_STORE], "readwrite");
            const accessObjectStore = transaction.objectStore(ACCESS_OBJECT_STORE);
            const count = accessObjectStore.count();
            count.onsuccess = () => {
                if (count.result > CACHE_LIMIT) {
                    let toRemove = count.result - CACHE_LIMIT;
                    const glyphsObjectStore = transaction.objectStore(GLYPHS_OBJECT_STORE);
                    const oldestCursor = accessObjectStore.index("accessTime").openCursor();
                    oldestCursor.onsuccess = () => {
                        if (toRemove > 0 && oldestCursor.result) {
                            toRemove--;
                            accessObjectStore.delete(oldestCursor.result.primaryKey)
                                .onerror = errorFromEvent;
                            glyphsObjectStore.delete(oldestCursor.result.primaryKey)
                                .onerror = errorFromEvent;
                            oldestCursor.result.continue();
                        }
                    };
                    oldestCursor.onerror = errorFromEvent;
                }
            };
            count.onerror = errorFromEvent;
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
