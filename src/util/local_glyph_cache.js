// @flow

import {warnOnce, extend} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';

const CACHE_NAME = 'mapbox-glyphs';
const GLYPHS_OBJECT_STORE = 'glyphs';
const ACCESS_OBJECT_STORE = 'access-times';

const CACHE_LIMIT = 4000;

function errorFromEvent(event) {
    warnOnce(event.target.error);
}

class LocalGlyphCache {
    db: ?Promise<IDBDatabase>;
    fontFamily: ?string;

    cachedGlyphMap: {[string]: StyleGlyph};
    loadingCallbacks: Array<{key: string, callback: (error: ?any, response: ?StyleGlyph) => void}>;
    cacheLoaded: boolean;

    constructor(localFontFamily: ?string) {
        this.cachedGlyphMap = {};
        this.loadingCallbacks = [];
        this.cacheLoaded = false;
        if (localFontFamily) {
            this._cacheOpen(localFontFamily);
        }

        setTimeout(this._cleanCache, 5000);
    }

    _onCacheLoaded(error: ?any): void {
        this.cacheLoaded = true;
        this.loadingCallbacks.forEach(loading => {
            loading.callback(error, cachedGlyphMap[loading.key]);
        });
        this.loadingCallbacks = [];
        if (error) {
            this.db = undefined; // Prevents further gets/puts
        }
    }

    _loadCache(): void {
        if (!this.db) return;

        this.db.then(db => {
            const transaction = db.transaction([GLYPHS_OBJECT_STORE], "readonly");
            // Flow annotation for IDBObjectStore doesn't include getAll()
            const objectStore: any = transaction.objectStore(GLYPHS_OBJECT_STORE);
            const request = objectStore.getAll();
            request.onsuccess = () => {
                if (request.result) {
                    request.result.forEach(glyph => {
                        const {metrics, bitmap, fontname, id} = glyph;
                        this.cachedGlyphMap[this._cacheKey(fontname, id)] = {
                            id,
                            metrics,
                            bitmap: new AlphaImage({
                                width: bitmap.width,
                                height: bitmap.height
                            }, bitmap.data)};
                    });
                }
                this._onCacheLoaded();
            };
            request.onerror = () => {
                this._onCacheLoaded(request.error);
            };
        }).catch(error => {
            this._onCacheLoaded(error);
        });
    }

    _cacheOpen(sessionFontFamily: string): void {
        this.fontFamily = sessionFontFamily;
        if (window.indexedDB && !this.db) {
            this.db = new Promise((resolve, reject) => {
                const IDBOpenDBRequest = window.indexedDB.open(CACHE_NAME);
                IDBOpenDBRequest.onsuccess = () => {
                    IDBOpenDBRequest.result.onversionchange = () => {
                        warnOnce("Closing glyph cache connection because database is being upgraded in another tab.");
                        this.db = undefined; // Prevents further gets/puts
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
            this._loadCache();
        }
    }

    // We're never closing the cache, but our unit tests rely on changing out the global window.caches
    // object, so we have a function specifically for unit tests that allows resetting the shared cache.
    cacheClose(): void {
        this.db = undefined;
    }

    _cacheKey(fontname: string, id: number): string {
        return `${this.fontFamily}/${fontname}/${id}`;
    }

    _accessTime() {
        return { accessTime: Math.round(new Date().getTime() / 1000) };
    }

    _delayPut(put: () => void) {
        // Spread out cache writes to avoid blocking foreground
        // Not a big deal if some writes don't get committed before session ends
        if (window.requestIdleCallback) {
            window.requestIdleCallback(put);
        } else {
            setTimeout(put, 5000 + Math.round(Math.random() * 10000));
        }
    }

    cachePut(fontname: string, glyph: StyleGlyph): void {
        if (!this.db) return;

        this._delayPut(() => {
            if (!this.db) return;
            this.db.then(db => {
                const transaction = db.transaction(
                    [GLYPHS_OBJECT_STORE, ACCESS_OBJECT_STORE], "readwrite");
                transaction.objectStore(GLYPHS_OBJECT_STORE)
                    .put(extend(glyph, {fontname}), this._cacheKey(fontname, glyph.id))
                    .onerror = errorFromEvent;

                transaction.objectStore(ACCESS_OBJECT_STORE)
                    .put(this._accessTime(), this._cacheKey(fontname, glyph.id))
                    .onerror = errorFromEvent;
            });
        });
    }

    cacheMarkUsed(fontname: string, id: number): void {
        if (!this.db) return;

        this._delayPut(() => {
            if (!this.db) return;
            this.db.then(db => {
                const transaction = db.transaction([ACCESS_OBJECT_STORE], "readwrite");
                transaction.objectStore(ACCESS_OBJECT_STORE)
                    .put(this._accessTime(), this._cacheKey(fontname, id))
                    .onerror = errorFromEvent;
            });
        });
    }

    _cleanCache(): void {
        if (!this.db) return;

        this._delayPut(() => {
            if (!this.db) return;
            this.db.then(db => {
                // Note we could do the count as a "readonly" transaction and then
                // escalate to "readwrite", with only downside being potential for two
                // maps to double-clean. We stick with a single "readwrite" transaction
                // just because it's simpler and this is a write-heavy database so
                // it shouldn't make much of a difference for contention.
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

    cacheGet(fontname: string, id: number, callback: (error: ?any, response: ?StyleGlyph) => void): void {
        if (!this.db || this.cacheLoaded) {
            callback(null, this.cachedGlyphMap[this._cacheKey(fontname, id)]);
        } else {
            this.loadingCallbacks.push({key: this._cacheKey(fontname, id), callback});
        }
    }

}


export default LocalGlyphCache;
