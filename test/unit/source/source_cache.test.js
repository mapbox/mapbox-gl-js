import {describe, test, expect, waitFor, vi} from "../../util/vitest.js";
import SourceCache from '../../../src/source/source_cache.js';
import {create, setType} from '../../../src/source/source.js';
import Tile from '../../../src/source/tile.js';
import {QueryGeometry} from '../../../src/style/query_geometry.js';
import {OverscaledTileID} from '../../../src/source/tile_id.js';
import Transform from '../../../src/geo/transform.js';
import LngLat from '../../../src/geo/lng_lat.js';
import Point from '@mapbox/point-geometry';
import {Event, ErrorEvent, Evented} from '../../../src/util/evented.js';
import {extend} from '../../../src/util/util.js';
import browser from '../../../src/util/browser.js';

// Add a mocked source type for use in these tests
function MockSourceType(id, sourceOptions, _dispatcher, eventedParent) {
    // allow tests to override mocked methods/properties by providing
    // them in the source definition object that's given to Source.create()
    class SourceMock extends Evented {
        constructor() {
            super();
            this.id = id;
            this.minzoom = 0;
            this.maxzoom = 22;
            extend(this, sourceOptions);
            this.setEventedParent(eventedParent);
            if (sourceOptions.hasTile) {
                this.hasTile = sourceOptions.hasTile;
            }
        }
        loadTile(tile, callback) {
            if (sourceOptions.expires) {
                tile.setExpiryData({
                    expires: sourceOptions.expires
                });
            }
            setTimeout(callback, 0);
        }
        loaded() {
            return true;
        }
        onAdd() {
            if (sourceOptions.noLoad) return;
            if (sourceOptions.error) {
                this.fire(new ErrorEvent(sourceOptions.error));
            } else {
                this.fire(new Event('data', {dataType: 'source', sourceDataType: 'metadata'}));
            }
        }
        abortTile() {}
        unloadTile() {}
        serialize() {}
    }
    const source = new SourceMock();

    return source;
}

setType('mock-source-type', MockSourceType);

export function createSourceCache(options, used) {
    const spec = options || {};
    spec['minzoom'] = spec['minzoom'] || 0;
    spec['maxzoom'] = spec['maxzoom'] || 14;

    const eventedParent = new Evented();
    const sc = new SourceCache('id', create('id', extend({
        tileSize: 512,
        type: 'mock-source-type'
    }, spec), /* dispatcher */ {}, eventedParent));
    sc.used = typeof used === 'boolean' ? used : true;
    sc.transform = new Transform();
    sc.map = {painter: {transform: sc.transform}};
    return {sourceCache: sc, eventedParent};
}

describe('SourceCache#addTile', () => {
    test('loads tile when uncached', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const {sourceCache} = createSourceCache({
            loadTile(tile) {
                expect(tile.tileID).toEqual(tileID);
                expect(tile.uses).toEqual(0);
            }
        });
        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    test('adds tile when uncached', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const {sourceCache, eventedParent} = createSourceCache({});

        await new Promise(resolve => {
            eventedParent.on("dataloading", (data) => {
                expect(data.tile.tileID).toEqual(tileID);
                expect(data.tile.uses).toEqual(1);
                resolve();
            });
            sourceCache.onAdd();
            sourceCache._addTile(tileID);
        });
    });

    test('updates feature state on added uncached tile', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let updateFeaturesSpy;

        await new Promise(resolve => {

            const {sourceCache, eventedParent} = createSourceCache({
                async loadTile(tile, callback) {
                    eventedParent.on('data', () => {
                        expect(updateFeaturesSpy).toHaveBeenCalledTimes(1);
                        resolve();
                    });
                    updateFeaturesSpy = vi.spyOn(tile, 'setFeatureState');
                    tile.state = 'loaded';
                    callback();
                }
            });
            sourceCache.onAdd(undefined);
            sourceCache._addTile(tileID);
        });
    });

    test('uses cached tile', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        });

        eventedParent.on('dataloading', () => { add++; });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);
        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        expect(load).toEqual(1);
        expect(add).toEqual(1);
    });

    test('updates feature state on cached tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                callback();
            }
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = sourceCache._addTile(tileID);
        const updateFeaturesSpy = vi.spyOn(tile, 'setFeatureState');

        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        expect(updateFeaturesSpy.mock.calls.length).toEqual(1);
    });

    test('moves timers when adding tile from cache', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const time = new Date();
        time.setSeconds(time.getSeconds() + 5);

        const {sourceCache} = createSourceCache();
        sourceCache._setTileReloadTimer = (id) => {
            sourceCache._timers[id] = setTimeout(() => {}, 0);
        };
        sourceCache._loadTile = (tile, callback) => {
            tile.state = 'loaded';
            tile.getExpiryTimeout = () => 1000 * 60;
            sourceCache._setTileReloadTimer(tileID.key, tile);
            callback();
        };

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const id = tileID.key;
        expect(sourceCache._timers[id]).toBeFalsy();
        expect(sourceCache._cache.has(tileID)).toBeFalsy();

        sourceCache._addTile(tileID);

        expect(sourceCache._timers[id]).toBeTruthy();
        expect(sourceCache._cache.has(tileID)).toBeFalsy();

        sourceCache._removeTile(tileID.key);

        expect(sourceCache._timers[id]).toBeFalsy();
        expect(sourceCache._cache.has(tileID)).toBeTruthy();

        sourceCache._addTile(tileID);

        expect(sourceCache._timers[id]).toBeTruthy();
        expect(sourceCache._cache.has(tileID)).toBeFalsy();
    });

    test('does not reuse wrapped tile', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        });
        eventedParent.on('dataloading', () => { add++; });

        const t1 = sourceCache._addTile(tileID);
        const t2 = sourceCache._addTile(new OverscaledTileID(0, 1, 0, 0, 0));

        expect(load).toEqual(2);
        expect(add).toEqual(2);
        expect(t1).not.toEqual(t2);
    });

    test('should load tiles with identical overscaled Z but different canonical Z', () => {
        const {sourceCache} = createSourceCache();

        const tileIDs = [
            new OverscaledTileID(1, 0, 0, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)
        ];

        for (let i = 0; i < tileIDs.length; i++)
            sourceCache._addTile(tileIDs[i]);

        for (let i = 0; i < tileIDs.length; i++) {
            const id = tileIDs[i];
            const key = id.key;

            expect(sourceCache._tiles[key]).toBeTruthy();
            expect(sourceCache._tiles[key].tileID).toEqual(id);
        }
    }
    );
});

describe('SourceCache#removeTile', () => {
    test('removes tile', async () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const {sourceCache, eventedParent} = createSourceCache({});
        sourceCache._addTile(tileID);
        await waitFor(eventedParent, "data");
        sourceCache._removeTile(tileID.key);
        expect(sourceCache._tiles[tileID.key]).toBeFalsy();
    });

    test('caches (does not unload) loaded tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const {sourceCache} = createSourceCache({
            loadTile(tile) {
                tile.state = 'loaded';
            },
            unloadTile() {
                expect.unreachable();
            }
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
    });

    test('aborts and unloads unfinished tile', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const {sourceCache} = createSourceCache({
            abortTile(tile) {
                expect(tile.tileID).toEqual(tileID);
                abort++;
            },
            unloadTile(tile) {
                expect(tile.tileID).toEqual(tileID);
                unload++;
            }
        });

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        expect(abort).toEqual(1);
        expect(unload).toEqual(1);
    });

    test('_tileLoaded after _removeTile skips tile.added', () => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                // tile.added = t.notOk();
                sourceCache._removeTile(tileID.key);
                callback();
            }
        });
        sourceCache.map = {painter: {transform: new Transform(), crossTileSymbolIndex: "", tileExtentVAO: {}, context: {
            createIndexBuffer: () => {},
            createVertexBuffer: () => {}
        }}};

        sourceCache._addTile(tileID);
    });
});

describe('SourceCache / Source lifecycle', () => {
    test('does not fire load or change before source load event', async () => {
        await new Promise(resolve => {
            const {sourceCache, eventedParent} = createSourceCache({noLoad: true});
            eventedParent.on('data', expect.unreachable);
            sourceCache.onAdd();
            setTimeout(resolve, 1);
        });
    });

    test('forward load event', async () => {
        const {sourceCache, eventedParent} = createSourceCache({});
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') resolve();
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('forward change event', async () => {
        const {sourceCache, eventedParent} = createSourceCache();
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') resolve();
            });
            sourceCache.getSource().onAdd();
            sourceCache.getSource().fire(new Event('data'));
        });
    });

    test('forward error event', async () => {
        const {sourceCache, eventedParent} = createSourceCache({error: 'Error loading source'});
        await new Promise(resolve => {
            eventedParent.on('error', (err) => {
                expect(err.error).toMatch('Error loading source');
                resolve();
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('suppress 404 errors', async () => {
        const {sourceCache, eventedParent} = createSourceCache({status: 404, message: 'Not found'});
        eventedParent.on('error', expect.unreachable);
        sourceCache.getSource().onAdd();
    });

    test('loaded() true after source error', async () => {
        const {sourceCache, eventedParent} = createSourceCache({error: 'Error loading source'});
        await new Promise(resolve => {
            eventedParent.on('error', () => {
                expect(sourceCache.loaded()).toBeTruthy();
                resolve();
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('loaded() true after tile error', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        const {sourceCache, eventedParent} = createSourceCache({
            loadTile (tile, callback) {
                callback("error");
            }
        });
        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        }).on('error', () => {
            expect(sourceCache.loaded()).toBeTruthy();
        });

        sourceCache.getSource().onAdd();
    });

    test('reloads tiles after a data event where source is updated', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const expected = [new OverscaledTileID(0, 0, 0, 0, 0).key, new OverscaledTileID(0, 0, 0, 0, 0).key];
        expect.assertions(expected.length);

        const {sourceCache, eventedParent} = createSourceCache({
            async loadTile(tile, callback) {
                expect(tile.tileID.key).toBe(expected.shift());
                tile.state = 'loaded';
                callback();
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
                    resolve();
                }
            });

            sourceCache.getSource().onAdd();
        });
    });

    test('does not reload errored tiles', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile (tile, callback) {
                // this transform will try to load the four tiles at z1 and a single z0 tile
                // we only expect _reloadTile to be called with the 'loaded' z0 tile
                tile.state = tile.tileID.canonical.z === 1 ? 'errored' : 'loaded';
                callback();
            }
        });

        const reloadTileSpy = vi.spyOn(sourceCache, '_reloadTile');
        eventedParent.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });
        sourceCache.getSource().onAdd();
        // we expect the source cache to have five tiles, but only to have reloaded one
        expect(Object.keys(sourceCache._tiles).length).toEqual(5);
        expect(reloadTileSpy).toHaveBeenCalledTimes(1);
    });
});

describe('SourceCache#update', () => {
    test('loads no tiles if used is false', async () => {
        const transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 0;

        const {sourceCache, eventedParent} = createSourceCache({}, false);

        await new Promise(resolve => {

            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('loads covering tiles', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const {sourceCache, eventedParent} = createSourceCache({});
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('respects Source#hasTile method if it is present', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const {sourceCache, eventedParent} = createSourceCache({
            hasTile: (coord) => (coord.canonical.x !== 0)
        });
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds().sort()).toStrictEqual([
                        new OverscaledTileID(1, 0, 1, 1, 0).key,
                        new OverscaledTileID(1, 0, 1, 1, 1).key
                    ].sort());
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('removes unused tiles', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile: (tile, callback) => {
                tile.state = 'loaded';
                callback(null);
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);

                    transform.zoom = 1;
                    sourceCache.update(transform);

                    expect(sourceCache.getIds()).toStrictEqual([
                        new OverscaledTileID(1, 0, 1, 1, 1).key,
                        new OverscaledTileID(1, 0, 1, 0, 1).key,
                        new OverscaledTileID(1, 0, 1, 1, 0).key,
                        new OverscaledTileID(1, 0, 1, 0, 0).key
                    ]);
                    resolve();
                }
            });

            sourceCache.getSource().onAdd();
        });
    });

    test('retains parent tiles for pending children', async () => {
        const transform = new Transform();
        transform._test = 'retains';
        transform.resize(511, 511);
        transform.zoom = 0;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = (tile.tileID.key === new OverscaledTileID(0, 0, 0, 0, 0).key) ? 'loaded' : 'loading';
                callback();
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([new OverscaledTileID(0, 0, 0, 0, 0).key]);

                    transform.zoom = 1;
                    sourceCache.update(transform);

                    expect(sourceCache.getIds()).toStrictEqual([
                        new OverscaledTileID(0, 0, 0, 0, 0).key,
                        new OverscaledTileID(1, 0, 1, 1, 1).key,
                        new OverscaledTileID(1, 0, 1, 0, 1).key,
                        new OverscaledTileID(1, 0, 1, 1, 0).key,
                        new OverscaledTileID(1, 0, 1, 0, 0).key
                    ]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('retains parent tiles for pending children (wrapped)', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        transform.center = new LngLat(360, 0);

        const {sourceCache, eventedParent} = createSourceCache({
            async loadTile(tile) {
                tile.state = (tile.tileID.key === new OverscaledTileID(0, 1, 0, 0, 0).key) ? 'loaded' : 'loading';
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toEqual([new OverscaledTileID(0, 1, 0, 0, 0).key]);

                    transform.zoom = 1;
                    sourceCache.update(transform);

                    expect(sourceCache.getIds()).toEqual([
                        new OverscaledTileID(0, 1, 0, 0, 0).key,
                        new OverscaledTileID(1, 1, 1, 1, 1).key,
                        new OverscaledTileID(1, 1, 1, 0, 1).key,
                        new OverscaledTileID(1, 1, 1, 1, 0).key,
                        new OverscaledTileID(1, 1, 1, 0, 0).key
                    ]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('retains covered child tiles while parent tile is fading in', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 2;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        sourceCache._source.type = 'raster';
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);

                    expect(sourceCache.getIds()).toStrictEqual([
                        new OverscaledTileID(2, 0, 2, 2, 2).key,
                        new OverscaledTileID(2, 0, 2, 1, 2).key,
                        new OverscaledTileID(2, 0, 2, 2, 1).key,
                        new OverscaledTileID(2, 0, 2, 1, 1).key
                    ]);

                    transform.zoom = 0;
                    sourceCache.update(transform);

                    expect(sourceCache.getRenderableIds()).toHaveLength(5);

                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('retains covered child tiles while parent tile is fading at high pitch', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;
        transform.maxPitch = 85;
        transform.pitch = 85;
        transform.center = new LngLat(0, 0);

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        sourceCache._source.type = 'raster';
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([
                        new OverscaledTileID(13, 0, 13, 4096, 4094).key,
                        new OverscaledTileID(13, 0, 13, 4095, 4094).key,
                        new OverscaledTileID(14, 0, 14, 8192, 8192).key,
                        new OverscaledTileID(14, 0, 14, 8191, 8192).key,
                        new OverscaledTileID(14, 0, 14, 8192, 8191).key,
                        new OverscaledTileID(14, 0, 14, 8191, 8191).key,
                        new OverscaledTileID(14, 0, 14, 8192, 8190).key,
                        new OverscaledTileID(14, 0, 14, 8191, 8190).key
                    ]);

                    transform.center = new LngLat(0, -0.005);
                    sourceCache.update(transform);

                    expect(sourceCache.getRenderableIds().length).toEqual(10);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('retains a parent tile for fading even if a tile is partially covered by children', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);

                    transform.zoom = 2;
                    sourceCache.update(transform);

                    transform.zoom = 1;
                    sourceCache.update(transform);

                    expect(sourceCache._coveredTiles[(new OverscaledTileID(0, 0, 0, 0, 0).key)]).toEqual(true);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('retains children for fading when tile.fadeEndTime is not set', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = Date.now();
                tile.state = 'loaded';
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);

                    transform.zoom = 0;
                    sourceCache.update(transform);

                    expect(sourceCache.getRenderableIds().length).toEqual(5); // retains 0/0/0 and its four children
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('retains children when tile.fadeEndTime is in the future', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const fadeTime = 100;

        const start = Date.now();
        let time = start;
        vi.spyOn(browser, 'now').mockImplementation(() => time);

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.timeAdded = browser.now();
                tile.state = 'loaded';
                tile.fadeEndTime = browser.now() + fadeTime;
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    // load children
                    sourceCache.update(transform);

                    transform.zoom = 0;
                    sourceCache.update(transform);

                    expect(sourceCache.getRenderableIds().length).toEqual(5); // retains 0/0/0 and its four children

                    time = start + 98;
                    sourceCache.update(transform);
                    expect(sourceCache.getRenderableIds().length).toEqual(5); // retains 0/0/0 and its four children

                    time = start + fadeTime + 1;
                    sourceCache.update(transform);
                    expect(sourceCache.getRenderableIds().length).toEqual(1);  //drops children after fading is complete
                    resolve();
                }
            });

            sourceCache.getSource().onAdd();
        });
    });

    test('retains overscaled loaded children', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;

        // use slightly offset center so that sort order is better defined
        transform.center = new LngLat(-0.001, 0.001);

        const {sourceCache, eventedParent} = createSourceCache({
            reparseOverscaled: true,
            loadTile(tile, callback) {
                tile.state = tile.tileID.overscaledZ === 16 ? 'loaded' : 'loading';
                callback();
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    expect(sourceCache.getRenderableIds()).toStrictEqual([
                        new OverscaledTileID(16, 0, 14, 8192, 8192).key,
                        new OverscaledTileID(16, 0, 14, 8191, 8192).key,
                        new OverscaledTileID(16, 0, 14, 8192, 8191).key,
                        new OverscaledTileID(16, 0, 14, 8191, 8191).key
                    ]);

                    transform.zoom = 15;
                    sourceCache.update(transform);

                    expect(sourceCache.getRenderableIds()).toStrictEqual([
                        new OverscaledTileID(16, 0, 14, 8192, 8192).key,
                        new OverscaledTileID(16, 0, 14, 8191, 8192).key,
                        new OverscaledTileID(16, 0, 14, 8192, 8191).key,
                        new OverscaledTileID(16, 0, 14, 8191, 8191).key
                    ]);

                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('reassigns tiles for large jumps in longitude', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const {sourceCache, eventedParent} = createSourceCache({});

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    transform.center = new LngLat(360, 0);
                    const tileID = new OverscaledTileID(0, 1, 0, 0, 0);
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([tileID.key]);
                    const tile = sourceCache.getTile(tileID);

                    transform.center = new LngLat(0, 0);
                    const wrappedTileID = new OverscaledTileID(0, 0, 0, 0, 0);
                    sourceCache.update(transform);
                    expect(sourceCache.getIds()).toStrictEqual([wrappedTileID.key]);
                    expect(sourceCache.getTile(wrappedTileID)).toStrictEqual(tile);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });
});

describe('SourceCache#_updateRetainedTiles', () => {
    test('loads ideal tiles if they exist', () => {
        const stateCache = {};
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = stateCache[tile.tileID.key] || 'errored';
                callback();
            }
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const idealTile = new OverscaledTileID(1, 0, 1, 1, 1);
        stateCache[idealTile.key] = 'loaded';
        sourceCache._updateRetainedTiles([idealTile]);
        expect(getTileSpy).not.toHaveBeenCalled();
        expect(sourceCache.getIds()).toEqual([idealTile.key]);
    });

    test('retains all loaded children ', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'errored';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(3, 0, 3, 1, 2);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile);
        sourceCache._tiles[idealTile.key].state = 'errored';

        const loadedChildren = [
            new OverscaledTileID(4, 0, 4, 2, 4),
            new OverscaledTileID(4, 0, 4, 3, 4),
            new OverscaledTileID(4, 0, 4, 2, 5),
            new OverscaledTileID(5, 0, 5, 6, 10),
            new OverscaledTileID(5, 0, 5, 7, 10),
            new OverscaledTileID(5, 0, 5, 6, 11),
            new OverscaledTileID(5, 0, 5, 7, 11)
        ];

        for (const t of loadedChildren) {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        }

        const retained = sourceCache._updateRetainedTiles([idealTile]);
        expect(Object.keys(retained).sort().map(n => Number.parseInt(n, 10))).toEqual([
            // parents are requested because ideal ideal tile is not completely covered by
            // loaded child tiles
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 1),
            new OverscaledTileID(1, 0, 1, 0, 0),
            idealTile
        ].concat(loadedChildren).map(t => t.key).sort());
    });

    test('retains children for LOD cover', () => {
        const {sourceCache} = createSourceCache({
            minzoom: 2,
            maxzoom: 5,
            loadTile(tile, callback) {
                tile.state = 'errored';
                callback();
            }
        });

        const idealTiles = [
            new OverscaledTileID(5, 1, 5, 7, 10),
            new OverscaledTileID(4, 2, 4, 2, 4),
            new OverscaledTileID(3, 0, 3, 1, 2)
        ];
        for (const t of idealTiles) {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'errored';
        }

        const loadedChildren = [
            // Children of OverscaledTileID(3, 0, 3, 1, 2)
            new OverscaledTileID(4, 0, 4, 2, 4),
            new OverscaledTileID(4, 0, 4, 3, 4),
            new OverscaledTileID(4, 0, 4, 2, 5),
            new OverscaledTileID(5, 0, 5, 6, 10),
            new OverscaledTileID(5, 0, 5, 7, 10),
            new OverscaledTileID(5, 0, 5, 6, 11),
            new OverscaledTileID(5, 0, 5, 7, 11),

            // Children of OverscaledTileID(4, 2, 4, 2, 4). Overscale (not canonical.z) over maxzoom.
            new OverscaledTileID(5, 2, 5, 4, 8),
            new OverscaledTileID(5, 2, 5, 5, 8),
            new OverscaledTileID(6, 2, 5, 4, 9),
            new OverscaledTileID(9, 2, 5, 5, 9), // over maxUnderzooming.

            // Children over maxzoom and parent of new OverscaledTileID(5, 1, 5, 7, 10)
            new OverscaledTileID(6, 1, 6, 14, 20),
            new OverscaledTileID(6, 1, 6, 15, 20),
            new OverscaledTileID(6, 1, 6, 14, 21),
            new OverscaledTileID(6, 1, 6, 15, 21),
            new OverscaledTileID(4, 1, 4, 3, 5)
        ];

        for (const t of loadedChildren) {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        }

        const retained = sourceCache._updateRetainedTiles(idealTiles);

        // Filter out those that are not supposed to be retained:
        const filteredChildren = loadedChildren.filter(t => {
            return ![
                new OverscaledTileID(6, 1, 6, 14, 20),
                new OverscaledTileID(6, 1, 6, 15, 20),
                new OverscaledTileID(6, 1, 6, 14, 21),
                new OverscaledTileID(6, 1, 6, 15, 21),
                new OverscaledTileID(9, 2, 5, 5, 9)
            ].map(t => t.key).includes(t.key);
        });

        expect(Object.keys(retained).sort().map(n => Number.parseInt(n, 10))).toEqual([
            // parents are requested up to minzoom because ideal tiles are not
            // completely covered by loaded child tiles
            new OverscaledTileID(2, 0, 2, 0, 1),
            new OverscaledTileID(2, 2, 2, 0, 1),
            new OverscaledTileID(3, 2, 3, 1, 2)
        ].concat(idealTiles).concat(filteredChildren).map(t => t.key).sort());
    });

    test('adds parent tile if ideal tile errors and no child tiles are loaded', () => {
        const stateCache = {};
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = stateCache[tile.tileID.key] || 'errored';
                callback();
            }
        });

        const addTileSpy = vi.spyOn(sourceCache, '_addTile');
        const getTileSpy = vi.spyOn(sourceCache, 'getTile');

        const idealTiles = [new OverscaledTileID(1, 0, 1, 1, 1), new OverscaledTileID(1, 0, 1, 0, 1)];
        stateCache[idealTiles[0].key] = 'loaded';
        const retained = sourceCache._updateRetainedTiles(idealTiles);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // when child tiles aren't found, check and request parent tile
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        // retained tiles include all ideal tiles and any parents that were loaded to cover
        // non-existant tiles
        expect(retained).toEqual({
            // 1/0/1
            '1040': new OverscaledTileID(1, 0, 1, 0, 1),
            // 1/1/1
            '1552': new OverscaledTileID(1, 0, 1, 1, 1),
            // parent
            '0': new OverscaledTileID(0, 0, 0, 0, 0)
        });
        addTileSpy.mockRestore();
        getTileSpy.mockRestore();
    }
    );

    test('don\'t use wrong parent tile', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'errored';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile);
        sourceCache._tiles[idealTile.key].state = 'errored';

        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key] = new Tile(new OverscaledTileID(1, 0, 1, 1, 0));
        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key].state = 'loaded';

        const addTileSpy = vi.spyOn(sourceCache, '_addTile');
        const getTileSpy = vi.spyOn(sourceCache, 'getTile');

        sourceCache._updateRetainedTiles([idealTile]);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0), // not found
            new OverscaledTileID(0, 0, 0, 0, 0)  // not found
        ]);

        expect(addTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // ideal tile
            new OverscaledTileID(2, 0, 2, 0, 0),
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0), // not found
            new OverscaledTileID(0, 0, 0, 0, 0)  // not found
        ]);

        addTileSpy.mockRestore();
        getTileSpy.mockRestore();
    });

    test('use parent tile when ideal tile is not loaded', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 1);
        const parentTile = new OverscaledTileID(0, 0, 0, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile);
        sourceCache._tiles[idealTile.key].state = 'loading';
        sourceCache._tiles[parentTile.key] = new Tile(parentTile);
        sourceCache._tiles[parentTile.key].state = 'loaded';

        const addTileSpy = vi.spyOn(sourceCache, '_addTile');
        const getTileSpy = vi.spyOn(sourceCache, 'getTile');

        const retained = sourceCache._updateRetainedTiles([idealTile]);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parents
            new OverscaledTileID(0, 0, 0, 0, 0), // found
        ]);

        expect(retained).toEqual({
            // parent of ideal tile 0/0/0
            '0' : new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id 1/0/1
            '1040' : new OverscaledTileID(1, 0, 1, 0, 1)
        });

        addTileSpy.mockClear();
        getTileSpy.mockClear();

        // now make sure we don't retain the parent tile when the ideal tile is loaded
        sourceCache._tiles[idealTile.key].state = 'loaded';
        const retainedLoaded = sourceCache._updateRetainedTiles([idealTile]);

        expect(getTileSpy).not.toHaveBeenCalled();
        expect(retainedLoaded).toEqual({
            // only ideal tile retained
            '1040' : new OverscaledTileID(1, 0, 1, 0, 1)
        });

        addTileSpy.mockRestore();
        getTileSpy.mockRestore();
    });

    test('don\'t load parent if all immediate children are loaded', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(2, 0, 2, 1, 1);
        const loadedTiles = [new OverscaledTileID(3, 0, 3, 2, 2), new OverscaledTileID(3, 0, 3, 3, 2), new OverscaledTileID(3, 0, 3, 2, 3), new OverscaledTileID(3, 0, 3, 3, 3)];
        loadedTiles.forEach((t) => {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile]);
        // parent tile isn't requested because all covering children are loaded
        expect(getTileSpy.mock.calls.length).toEqual(0);
        expect(Object.keys(retained).map(n => Number.parseInt(n, 10))).toEqual([idealTile.key].concat(loadedTiles.map(t => t.key)));
    });

    test('prefer loaded child tiles to parent tiles', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 0);
        const loadedTiles = [new OverscaledTileID(0, 0, 0, 0, 0), new OverscaledTileID(2, 0, 2, 0, 0)];
        loadedTiles.forEach((t) => {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        let retained = sourceCache._updateRetainedTiles([idealTile]);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parent
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        expect(retained).toEqual({
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '0' : new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id (1, 0, 0)
            '16' : new OverscaledTileID(1, 0, 1, 0, 0),
            // loaded child tile (2, 0, 0)
            '32': new OverscaledTileID(2, 0, 2, 0, 0)
        });

        getTileSpy.mockRestore();
        // remove child tile and check that it only uses parent tile
        delete sourceCache._tiles['32'];
        retained = sourceCache._updateRetainedTiles([idealTile]);

        expect(retained).toEqual({
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '0' : new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id (1, 0, 0)
            '16' : new OverscaledTileID(1, 0, 1, 0, 0)
        });
    });

    test('don\'t use tiles below minzoom', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            minzoom: 2
        });
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        const loadedTiles = [new OverscaledTileID(1, 0, 1, 0, 0)];
        loadedTiles.forEach((t) => {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile]);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([]);

        expect(retained).toEqual({
            // ideal tile id (2, 0, 0)
            '32' : new OverscaledTileID(2, 0, 2, 0, 0)
        });

        getTileSpy.mockRestore();
    });

    test('use overzoomed tile above maxzoom', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            maxzoom: 2
        });
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile]);

        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // overzoomed child
            new OverscaledTileID(3, 0, 2, 0, 0),
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        expect(retained).toEqual({
            // ideal tile id (2, 0, 0)
            '32' : new OverscaledTileID(2, 0, 2, 0, 0)
        });

        getTileSpy.mockRestore();
    });

    test('dont\'t ascend multiple times if a tile is not found', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTiles = [new OverscaledTileID(8, 0, 8, 0, 0), new OverscaledTileID(8, 0, 8, 1, 0)];

        const getTileSpy = vi.spyOn(sourceCache, 'getTile');
        sourceCache._updateRetainedTiles(idealTiles);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parent tile ascent
            new OverscaledTileID(7, 0, 7, 0, 0),
            new OverscaledTileID(6, 0, 6, 0, 0),
            new OverscaledTileID(5, 0, 5, 0, 0),
            new OverscaledTileID(4, 0, 4, 0, 0),
            new OverscaledTileID(3, 0, 3, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(0, 0, 0, 0, 0),
        ]);

        getTileSpy.mockClear();

        const loadedTiles = [new OverscaledTileID(4, 0, 4, 0, 0)];
        loadedTiles.forEach((t) => {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        sourceCache._updateRetainedTiles(idealTiles);
        expect(getTileSpy.mock.calls.map((c) => { return c[0]; })).toEqual([
            // parent tile ascent
            new OverscaledTileID(7, 0, 7, 0, 0),
            new OverscaledTileID(6, 0, 6, 0, 0),
            new OverscaledTileID(5, 0, 5, 0, 0),
            new OverscaledTileID(4, 0, 4, 0, 0), // tile is loaded, stops ascent
        ]);

        getTileSpy.mockRestore();
    });

    test('adds correct leaded parent tiles for overzoomed tiles', () => {
        const {sourceCache} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            maxzoom: 7
        });
        const loadedTiles = [new OverscaledTileID(7, 0, 7, 0, 0), new OverscaledTileID(7, 0, 7, 1, 0)];
        loadedTiles.forEach((t) => {
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const idealTiles = [new OverscaledTileID(8, 0, 7, 0, 0), new OverscaledTileID(8, 0, 7, 1, 0)];
        const retained = sourceCache._updateRetainedTiles(idealTiles);

        expect(Uint32Array.from(Object.keys(retained)).sort()).toEqual(Uint32Array.from([
            new OverscaledTileID(7, 0, 7, 1, 0).key,
            new OverscaledTileID(8, 0, 7, 1, 0).key,
            new OverscaledTileID(8, 0, 7, 0, 0).key,
            new OverscaledTileID(7, 0, 7, 0, 0).key
        ]).sort());
    });
});

describe('SourceCache#clearTiles', () => {
    test('unloads tiles', () => {
        const coord = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const {sourceCache} = createSourceCache({
            abortTile(tile) {
                expect(tile.tileID).toEqual(coord);
                abort++;
            },
            unloadTile(tile) {
                expect(tile.tileID).toEqual(coord);
                unload++;
            }
        });
        sourceCache.onAdd();

        sourceCache._addTile(coord);
        sourceCache.clearTiles();

        expect(abort).toEqual(1);
        expect(unload).toEqual(1);
    });
});

describe('SourceCache#tilesIn', () => {
    test('graceful response before source loaded', () => {
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        tr._calcMatrices();
        const {sourceCache} = createSourceCache({noLoad: true});
        sourceCache.transform = tr;
        sourceCache.onAdd();
        const queryGeometry = QueryGeometry.createFromScreenPoints([new Point(0, 0), new Point(512, 256)], tr);
        expect(sourceCache.tilesIn(queryGeometry)).toEqual([]);
    });

    function round(queryGeometry) {
        return {
            min: queryGeometry.min.round(),
            max: queryGeometry.max.round()
        };
    }

    test('regular tiles', async () => {
        const transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 1;
        transform.center = new LngLat(0, 1);

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                tile.additionalRadius = 0;
                callback();
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);

                    expect(sourceCache.getIds()).toStrictEqual([
                        new OverscaledTileID(1, 0, 1, 1, 1).key,
                        new OverscaledTileID(1, 0, 1, 0, 1).key,
                        new OverscaledTileID(1, 0, 1, 1, 0).key,
                        new OverscaledTileID(1, 0, 1, 0, 0).key
                    ]);

                    transform._calcMatrices();
                    const queryGeometry = QueryGeometry.createFromScreenPoints([new Point(0, 0), new Point(512, 256)], transform);
                    const tiles = sourceCache.tilesIn(queryGeometry, false, false);

                    tiles.sort((a, b) => { return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x; });
                    tiles.forEach((result) => { delete result.tile.uid; });

                    expect(tiles[0].tile.tileID.key).toEqual(16);
                    expect(tiles[0].tile.tileSize).toEqual(512);
                    expect(round(tiles[0].bufferedTilespaceBounds)).toStrictEqual({min: {x: 4080, y: 4034}, max: {x:8192, y: 8162}});

                    expect(tiles[1].tile.tileID.key).toEqual(528);
                    expect(tiles[1].tile.tileSize).toEqual(512);
                    expect(round(tiles[1].bufferedTilespaceBounds)).toStrictEqual({min: {x: 0, y: 4034}, max: {x: 4112, y: 8162}});

                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('reparsed overscaled tiles', async () => {
        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) {
                tile.state = 'loaded';
                tile.additionalRadius = 0;
                callback();
            },
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    const transform = new Transform();
                    transform.resize(1024, 1024);
                    transform.zoom = 2.0;
                    transform.center = new LngLat(0, 1);
                    sourceCache.update(transform);

                    expect(sourceCache.getIds()).toStrictEqual([
                        new OverscaledTileID(2, 0, 1, 1, 1).key,
                        new OverscaledTileID(2, 0, 1, 0, 1).key,
                        new OverscaledTileID(2, 0, 1, 1, 0).key,
                        new OverscaledTileID(2, 0, 1, 0, 0).key
                    ]);

                    const queryGeometry = QueryGeometry.createFromScreenPoints([new Point(0, 0), new Point(1024, 512)], transform);

                    const tiles = sourceCache.tilesIn(queryGeometry);

                    tiles.sort((a, b) => { return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x; });
                    tiles.forEach((result) => { delete result.tile.uid; });

                    expect(tiles[0].tile.tileID.key).toEqual(17);
                    expect(tiles[0].tile.tileSize).toEqual(1024);
                    expect(round(tiles[0].bufferedTilespaceBounds)).toStrictEqual({min: {x: 4088, y: 4042}, max: {x:8192, y: 8154}});

                    expect(tiles[1].tile.tileID.key).toEqual(529);
                    expect(tiles[1].tile.tileSize).toEqual(1024);
                    expect(round(tiles[1].bufferedTilespaceBounds)).toStrictEqual({min: {x: 0, y: 4042}, max: {x: 4104, y: 8154}});

                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });

    test('overscaled tiles', async () => {
        const {sourceCache, eventedParent} = createSourceCache({
            loadTile(tile, callback) { tile.state = 'loaded'; callback(); },
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    const transform = new Transform();
                    transform.resize(512, 512);
                    transform.zoom = 2.0;
                    sourceCache.update(transform);

                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });
});

test('SourceCache#loaded (no errors)', async () => {
    const {sourceCache, eventedParent} = createSourceCache({
        loadTile(tile, callback) {
            tile.state = 'loaded';
            callback();
        }
    });

    await new Promise(resolve => {
        eventedParent.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const coord = new OverscaledTileID(0, 0, 0, 0, 0);
                sourceCache._addTile(coord);

                expect(sourceCache.loaded()).toBeTruthy();

                resolve();
            }
        });
        sourceCache.getSource().onAdd();
    });
});

test('SourceCache#loaded (with errors)', async () => {
    const {sourceCache, eventedParent} = createSourceCache({
        loadTile(tile) {
            tile.state = 'errored';
        }
    });

    await new Promise(resolve => {
        eventedParent.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const coord = new OverscaledTileID(0, 0, 0, 0, 0);
                sourceCache._addTile(coord);

                expect(sourceCache.loaded()).toBeTruthy();

                resolve();
            }
        });
        sourceCache.getSource().onAdd();

    });
});

test('SourceCache#getIds (ascending order by zoom level)', () => {
    const ids = [
        new OverscaledTileID(0, 0, 0, 0, 0),
        new OverscaledTileID(3, 0, 3, 0, 0),
        new OverscaledTileID(1, 0, 1, 0, 0),
        new OverscaledTileID(2, 0, 2, 0, 0)
    ];

    const {sourceCache} = createSourceCache({});
    sourceCache.transform = new Transform();
    for (let i = 0; i < ids.length; i++) {
        sourceCache._tiles[ids[i].key] = {tileID: ids[i]};
    }
    expect(sourceCache.getIds()).toEqual([
        new OverscaledTileID(0, 0, 0, 0, 0).key,
        new OverscaledTileID(1, 0, 1, 0, 0).key,
        new OverscaledTileID(2, 0, 2, 0, 0).key,
        new OverscaledTileID(3, 0, 3, 0, 0).key
    ]);
    sourceCache.onAdd();
});

describe('SourceCache#findLoadedParent', () => {
    test('adds from previously used tiles (sourceCache._tiles)', () => {
        const {sourceCache} = createSourceCache({});
        sourceCache.onAdd();
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = {
            tileID: new OverscaledTileID(1, 0, 1, 0, 0),
            hasData() { return true; }
        };

        sourceCache._tiles[tile.tileID.key] = tile;

        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0)).toEqual(undefined);
        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0)).toEqual(tile);
    });

    test('retains parents', () => {
        const {sourceCache} = createSourceCache({});
        sourceCache.onAdd();
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512, 22);
        sourceCache._cache.add(tile.tileID, tile);

        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0)).toEqual(undefined);
        expect(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0)).toEqual(tile);
        expect(sourceCache._cache.order.length).toEqual(1);
    });

    test('Search cache for loaded parent tiles', () => {
        const {sourceCache} = createSourceCache({});
        sourceCache.onAdd();
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const mockTile = id => {
            const tile = {
                tileID: id,
                hasData() { return true; }
            };
            sourceCache._tiles[id.key] = tile;
        };

        const tiles = [
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(2, 0, 2, 0, 0),
            new OverscaledTileID(2, 0, 2, 1, 0),
            new OverscaledTileID(2, 0, 2, 2, 0),
            new OverscaledTileID(2, 0, 2, 1, 2)
        ];

        tiles.forEach(t => mockTile(t));
        sourceCache._updateLoadedParentTileCache();

        // Loaded tiles excluding the root should be in the cache
        expect(sourceCache.findLoadedParent(tiles[0], 0)).toEqual(undefined);
        expect(sourceCache.findLoadedParent(tiles[1], 0).tileID).toEqual(tiles[0]);
        expect(sourceCache.findLoadedParent(tiles[2], 0).tileID).toEqual(tiles[0]);
        expect(sourceCache.findLoadedParent(tiles[3], 0).tileID).toEqual(tiles[0]);
        expect(sourceCache.findLoadedParent(tiles[4], 0).tileID).toEqual(tiles[1]);
        expect(sourceCache.findLoadedParent(tiles[5], 0).tileID).toEqual(tiles[0]);

        expect(tiles[0].key in sourceCache._loadedParentTiles).toEqual(false);
        expect(tiles[1].key in sourceCache._loadedParentTiles).toEqual(true);
        expect(tiles[2].key in sourceCache._loadedParentTiles).toEqual(true);
        expect(tiles[3].key in sourceCache._loadedParentTiles).toEqual(true);
        expect(tiles[4].key in sourceCache._loadedParentTiles).toEqual(true);
        expect(tiles[5].key in sourceCache._loadedParentTiles).toEqual(true);

        // Arbitray tiles should not in the cache
        const notLoadedTiles = [
            new OverscaledTileID(2, 1, 2, 0, 0),
            new OverscaledTileID(2, 0, 2, 3, 0),
            new OverscaledTileID(2, 0, 2, 3, 3),
            new OverscaledTileID(3, 0, 3, 2, 1)
        ];

        expect(sourceCache.findLoadedParent(notLoadedTiles[0], 0)).toEqual(undefined);
        expect(sourceCache.findLoadedParent(notLoadedTiles[1], 0).tileID).toEqual(tiles[1]);
        expect(sourceCache.findLoadedParent(notLoadedTiles[2], 0).tileID).toEqual(tiles[0]);
        expect(sourceCache.findLoadedParent(notLoadedTiles[3], 0).tileID).toEqual(tiles[3]);

        expect(notLoadedTiles[0].key in sourceCache._loadedParentTiles).toEqual(false);
        expect(notLoadedTiles[1].key in sourceCache._loadedParentTiles).toEqual(false);
        expect(notLoadedTiles[2].key in sourceCache._loadedParentTiles).toEqual(false);
        expect(notLoadedTiles[3].key in sourceCache._loadedParentTiles).toEqual(false);
    });
});

describe('SourceCache#reload', () => {
    test('before loaded', () => {
        const {sourceCache} = createSourceCache({noLoad: true});
        sourceCache.onAdd();

        expect(() => {
            sourceCache.reload();
        }).not.toThrowError();
    });
});

describe('SourceCache reloads expiring tiles', () => {
    test('calls reloadTile when tile expires', () => {
        const coord = new OverscaledTileID(1, 0, 1, 0, 1, 0, 0);

        const expiryDate = new Date();
        expiryDate.setMilliseconds(expiryDate.getMilliseconds() + 50);
        const {sourceCache} = createSourceCache({expires: expiryDate});

        sourceCache._reloadTile = (id, state) => {
            expect(state).toEqual('expired');
        };

        sourceCache._addTile(coord);
    });
});

describe('SourceCache sets max cache size correctly', () => {
    test('sets cache size based on 256 tiles', () => {
        const {sourceCache} = createSourceCache({
            tileSize: 256
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 3 * 3 * 5
        expect(sourceCache._cache.max).toEqual(45);
    });

    test('sets cache size given optional tileSize', () => {
        const {sourceCache} = createSourceCache({
            tileSize: 256
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr, 2048);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 3 * 3 * 5
        expect(sourceCache._cache.max).toEqual(20);
    });

    test('sets cache size based on 512 tiles', () => {
        const {sourceCache} = createSourceCache({
            tileSize: 512
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 2 * 2 * 5
        expect(sourceCache._cache.max).toEqual(20);
    });
});

describe('SourceCache loads tiles recursively', () => {
    test('loads parent tiles on 404', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;

        const maxAvailableZoom = 10;
        let loadedTiles = 0;

        const {sourceCache, eventedParent} = createSourceCache({
            maxzoom: 14,
            loadTile (tile, callback) {
                if (tile.tileID.canonical.z > maxAvailableZoom) {
                    setTimeout(() => callback({status: 404}), 0);
                } else {
                    tile.state = 'loaded';
                    callback(null);
                }
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    return;
                }

                if (e.tile) loadedTiles++;
                if (loadedTiles === 4) setTimeout(() => assert(resolve), 0);
            });

            sourceCache.getSource().onAdd();
        });

        function assert(resolve) {
            expect(sourceCache.getRenderableIds()).toEqual([
                new OverscaledTileID(10, 0, 10, 512, 512).key,
                new OverscaledTileID(10, 0, 10, 511, 512).key,
                new OverscaledTileID(10, 0, 10, 512, 511).key,
                new OverscaledTileID(10, 0, 10, 511, 511).key,
            ]);

            expect(sourceCache.getIds()).toEqual([
                new OverscaledTileID(10, 0, 10, 512, 512).key,
                new OverscaledTileID(10, 0, 10, 511, 512).key,
                new OverscaledTileID(10, 0, 10, 512, 511).key,
                new OverscaledTileID(10, 0, 10, 511, 511).key,
                new OverscaledTileID(11, 0, 11, 1024, 1024).key,
                new OverscaledTileID(11, 0, 11, 1023, 1024).key,
                new OverscaledTileID(11, 0, 11, 1024, 1023).key,
                new OverscaledTileID(11, 0, 11, 1023, 1023).key,
                new OverscaledTileID(12, 0, 12, 2048, 2048).key,
                new OverscaledTileID(12, 0, 12, 2047, 2048).key,
                new OverscaledTileID(12, 0, 12, 2048, 2047).key,
                new OverscaledTileID(12, 0, 12, 2047, 2047).key,
                new OverscaledTileID(13, 0, 13, 4096, 4096).key,
                new OverscaledTileID(13, 0, 13, 4095, 4096).key,
                new OverscaledTileID(13, 0, 13, 4096, 4095).key,
                new OverscaledTileID(13, 0, 13, 4095, 4095).key,
                new OverscaledTileID(14, 0, 14, 8192, 8192).key,
                new OverscaledTileID(14, 0, 14, 8191, 8192).key,
                new OverscaledTileID(14, 0, 14, 8192, 8191).key,
                new OverscaledTileID(14, 0, 14, 8191, 8191).key,
            ]);
            resolve();
        }
    });

    test('fires `data` event with `error` sourceDataType if all tiles are 404', async () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const {sourceCache, eventedParent} = createSourceCache({
            loadTile (tile, callback) {
                setTimeout(() => callback({status: 404}), 0);
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    sourceCache.update(transform);
                    return;
                }

                if (e.dataType === 'source' && e.sourceDataType === 'error') {
                    expect(sourceCache.loaded()).toEqual(true);
                    expect(sourceCache.getRenderableIds()).toStrictEqual([]);

                    const tileStates = Object.values(sourceCache._tiles).map(t => t.state);
                    expect(tileStates).toStrictEqual(Array(5).fill('errored'));

                    resolve();
                }
            });

            sourceCache.getSource().onAdd();
        });
    });
});

describe('SourceCache#_preloadTiles', () => {
    test('preloads tiles', async () => {
        const initialTransform = new Transform();
        initialTransform.resize(511, 511);
        initialTransform.zoom = 0;

        const transforms = Array.from({length: 3}, (_, i) => {
            const transform = initialTransform.clone();
            transform.zoom = i + 1;
            return transform;
        });

        const expected = [
            // initial transform tiles
            new OverscaledTileID(0, 0, 0, 0, 0).key,
            // preload transform tiles
            new OverscaledTileID(1, 0, 1, 1, 1).key,
            new OverscaledTileID(1, 0, 1, 0, 1).key,
            new OverscaledTileID(1, 0, 1, 1, 0).key,
            new OverscaledTileID(1, 0, 1, 0, 0).key,
            new OverscaledTileID(2, 0, 2, 2, 2).key,
            new OverscaledTileID(2, 0, 2, 1, 2).key,
            new OverscaledTileID(2, 0, 2, 2, 1).key,
            new OverscaledTileID(2, 0, 2, 1, 1).key,
            new OverscaledTileID(3, 0, 3, 4, 4).key,
            new OverscaledTileID(3, 0, 3, 3, 4).key,
            new OverscaledTileID(3, 0, 3, 4, 3).key,
            new OverscaledTileID(3, 0, 3, 3, 3).key,
        ];

        expect.assertions(expected.length);

        const {sourceCache, eventedParent} = createSourceCache({
            reparseOverscaled: true,
            loadTile (tile, callback) {
                expect(tile.tileID.key).toEqual(expected.shift());
                tile.state = 'loaded';
                callback(null);
            }
        });

        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                    sourceCache.update(initialTransform);
                    sourceCache._preloadTiles(transforms, () => {
                        resolve();
                    });
                }
            });

            sourceCache.getSource().onAdd();
        });
    });

    test('waits until source is loaded before preloading tiles', () => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const {sourceCache} = createSourceCache({
            loadTile (tile) {
                expect(sourceCache._sourceLoaded).toBeTruthy();
                expect(tile.tileID.key).toEqual(new OverscaledTileID(0, 0, 0, 0, 0).key);
            }
        });

        // Marks source as not loaded
        sourceCache._sourceLoaded = false;
        sourceCache._preloadTiles(transform);

        // Fires event that marks source as loaded
        sourceCache.getSource().onAdd();
    });
});

describe('Visible coords with shadows', () => {
    const transform = new Transform();
    transform.resize(512, 512);
    transform.center = new LngLat(40.7125638, -74.0052634);
    transform.zoom = 19.7;
    transform.pitch = 69;
    transform.bearing = 39.2;

    const {sourceCache, eventedParent} = createSourceCache({
        reparseOverscaled: true,
        loadTile(tile, callback) {
            tile.state = 'loaded';
            callback(null);
        }
    });

    sourceCache.updateCacheSize(transform);
    sourceCache.castsShadows = true;
    test('getVisibleCoordinates', async () => {
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform, 512, false, [0.25, -0.433, -0.866]);
                    expect(sourceCache.getVisibleCoordinates().length).toEqual(2);
                    expect(sourceCache.getRenderableIds(false, false)).toStrictEqual([
                        new OverscaledTileID(19, 0, 14, 10044, 8192).key,
                        new OverscaledTileID(19, 0, 14, 10044, 8191).key,
                    ]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });
});

test('sortCoordinatesByDistance', () => {
    const transform = new Transform();
    transform.resize(512, 512);
    transform.center = new LngLat(0, 0);
    transform.zoom = 2;
    transform.pitch = 75;
    transform.bearing = 45.1;

    const {sourceCache, eventedParent} = createSourceCache({
        reparseOverscaled: true,
        loadTile(tile, callback) {
            tile.state = 'loaded';
            callback(null);
        }
    });

    eventedParent.on('data', (e) => {
        if (e.sourceDataType === 'metadata') {
            sourceCache.update(transform, 512, false);
            const coords = sourceCache.getVisibleCoordinates();

            const defaultOrder = [
                {wrap: 1, canonical: {z: 2, x: 0, y: 1}},
                {wrap: 1, canonical: {z: 2, x: 0, y: 0}},
                {wrap: 0, canonical: {z: 2, x: 2, y: 2}},
                {wrap: 0, canonical: {z: 2, x: 1, y: 2}},
                {wrap: 0, canonical: {z: 2, x: 3, y: 1}},
                {wrap: 0, canonical: {z: 2, x: 2, y: 1}},
                {wrap: 0, canonical: {z: 2, x: 1, y: 1}},
                {wrap: 0, canonical: {z: 2, x: 3, y: 0}},
                {wrap: 0, canonical: {z: 2, x: 2, y: 0}}
            ];

            expect(coords.map(tile => ({
                wrap: tile.wrap,
                canonical: {
                    z: tile.canonical.z,
                    x: tile.canonical.x,
                    y: tile.canonical.y
                }
            }))).toEqual(defaultOrder);

            const sortedOrder = [
                {wrap: 0, canonical: {z: 2, x: 1, y: 2}},
                {wrap: 0, canonical: {z: 2, x: 1, y: 1}},
                {wrap: 0, canonical: {z: 2, x: 2, y: 2}},
                {wrap: 0, canonical: {z: 2, x: 2, y: 1}},
                {wrap: 0, canonical: {z: 2, x: 2, y: 0}},
                {wrap: 0, canonical: {z: 2, x: 3, y: 1}},
                {wrap: 0, canonical: {z: 2, x: 3, y: 0}},
                {wrap: 1, canonical: {z: 2, x: 0, y: 1}},
                {wrap: 1, canonical: {z: 2, x: 0, y: 0}}
            ];

            expect(
                sourceCache.sortCoordinatesByDistance(coords).map(tile => ({
                    wrap: tile.wrap,
                    canonical: {
                        z: tile.canonical.z,
                        x: tile.canonical.x,
                        y: tile.canonical.y
                    }
                }))
            ).toStrictEqual(sortedOrder);
        }
    });
    sourceCache.getSource().onAdd();
});

describe('shadow caster tiles', () => {
    const transform = new Transform();
    transform.resize(512, 512);
    transform.center = new LngLat(40.7125638, -74.0052634);
    transform.zoom = 19.7;
    transform.pitch = 69;
    transform.bearing = 39.2;

    const {sourceCache, eventedParent} = createSourceCache({
        reparseOverscaled: true,
        loadTile(tile, callback) {
            tile.state = 'loaded';
            callback(null);
        }
    });

    sourceCache.updateCacheSize(transform);
    sourceCache.castsShadows = true;
    test('getShadowCasterCoordinates', async () => {
        await new Promise(resolve => {
            eventedParent.on('data', (e) => {
                if (e.sourceDataType === 'metadata') {
                    sourceCache.update(transform, 512, false, [0.25, -0.433, -0.866]);
                    expect(sourceCache.getShadowCasterCoordinates().length).toEqual(6);
                    expect(sourceCache.getRenderableIds(false, true)).toStrictEqual([
                        new OverscaledTileID(19, 0, 14, 10044, 8193).key,
                        new OverscaledTileID(19, 0, 14, 10043, 8193).key,
                        new OverscaledTileID(19, 0, 14, 10044, 8192).key,
                        new OverscaledTileID(19, 0, 14, 10043, 8192).key,
                        new OverscaledTileID(19, 0, 14, 10044, 8191).key,
                        new OverscaledTileID(19, 0, 14, 10043, 8191).key,
                    ]);
                    resolve();
                }
            });
            sourceCache.getSource().onAdd();
        });
    });
});

