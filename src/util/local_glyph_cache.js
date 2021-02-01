// @flow

import {warnOnce, parseCacheControl} from './util';
import type {StyleGlyph} from '../style/style_glyph';
import window from './window';
import {AlphaImage} from './image';
import parseGlyphPBF from '../style/parse_glyph_pbf';
import writeGlyphPBF from '../style/write_glyph_pbf';

import {SDF_SCALE} from '../render/glyph_manager';

const CACHE_NAME = 'mapbox-glyphs';

let db;

function cacheOpen() {
    if (window.indexedDB && !db) {
        db = new Promise((resolve, reject) => {
            const IDBOpenDBRequest = window.indexedDB.open(CACHE_NAME);
            IDBOpenDBRequest.onsuccess = event => {
                resolve(IDBOpenDBRequest.result);
            }
            IDBOpenDBRequest.onupgradeneeded = event =>  {
                var db = event.target.result;

                db.onerror = event => {
                    reject(event);
                };

                var objectStore = db.createObjectStore(CACHE_NAME);
            };
            IDBOpenDBRequest.onerror = (event) => {
                reject(IDBOpenDBRequest.error);
            }
        });
    }
}

// We're never closing the cache, but our unit tests rely on changing out the global window.caches
// object, so we have a function specifically for unit tests that allows resetting the shared cache.
export function cacheClose() {
    db = undefined;
}

export function cachePut(fontname: string, glyph: StyleGlyph) {
    cacheOpen();
    if (!db) return;

    db.then(db => {
        const transaction = db.transaction([CACHE_NAME], "readwrite");
        const objectStore = transaction.objectStore(CACHE_NAME);
        const request = objectStore.put(glyph, `${fontname}/${glyph.id}`);
        request.onsuccess = event => {
        }
        request.onerror = event => {
            warnOnce(request.error);
        }
    });
}


export function cacheGet(fontname: string, id: number, callback: (error: ?any, response: ?StyleGlyph) => void) {
    cacheOpen();
    if (!db) return callback();

    db.then(db => {
        const transaction = db.transaction([CACHE_NAME], "readonly");
        const objectStore = transaction.objectStore(CACHE_NAME);
        const request = objectStore.get(`${fontname}/${id}`);
        request.onsuccess = event => {
            if (request.result) {
                const {metrics, bitmap} = request.result;
                callback(null, {
                    id,
                    metrics,
                    bitmap: new AlphaImage({
                        width: bitmap.width,
                        height: bitmap.height
                    }, bitmap.data)});
            } else {
                callback();
            }
        }
        request.onerror = event => {
            callback(request.error);
        }
    });
}
