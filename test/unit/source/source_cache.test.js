import { test } from 'mapbox-gl-js-test';
import SourceCache from '../../../src/source/source_cache';
import {setType} from '../../../src/source/source';
import Tile from '../../../src/source/tile';
import { OverscaledTileID } from '../../../src/source/tile_id';
import Transform from '../../../src/geo/transform';
import LngLat from '../../../src/geo/lng_lat';
import Coordinate from '../../../src/geo/coordinate';
import { Event, ErrorEvent, Evented } from '../../../src/util/evented';
import { extend } from '../../../src/util/util';
import browser from '../../../src/util/browser';

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

function createSourceCache(options, used) {
    const sc = new SourceCache('id', extend({
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        type: 'mock-source-type'
    }, options), /* dispatcher */ {});
    sc.used = typeof used === 'boolean' ? used : true;
    return sc;
}

test('SourceCache#addTile', (t) => {
    t.test('loads tile when uncached', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({
            loadTile: function(tile) {
                t.deepEqual(tile.tileID, tileID);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('adds tile when uncached', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({}).on('dataloading', (data) => {
            t.deepEqual(data.tile.tileID, tileID);
            t.equal(data.tile.uses, 1);
            t.end();
        });
        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('updates feature state on added uncached tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let updateFeaturesSpy;
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                sourceCache.on('data', () => {
                    t.equal(updateFeaturesSpy.getCalls().length, 1);
                    t.end();
                });
                updateFeaturesSpy = t.spy(tile, 'setFeatureState');
                tile.state = 'loaded';
                callback();
            }
        });
        sourceCache.onAdd();
        sourceCache._addTile(tileID);
    });

    t.test('uses cached tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        }).on('dataloading', () => { add++; });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);
        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        t.equal(load, 1);
        t.equal(add, 1);

        t.end();
    });

    t.test('updates feature state on cached tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                callback();
            }
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = sourceCache._addTile(tileID);
        const updateFeaturesSpy = t.spy(tile, 'setFeatureState');

        sourceCache._removeTile(tileID.key);
        sourceCache._addTile(tileID);

        t.equal(updateFeaturesSpy.getCalls().length, 1);

        t.end();
    });

    t.test('moves timers when adding tile from cache', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const time = new Date();
        time.setSeconds(time.getSeconds() + 5);

        const sourceCache = createSourceCache();
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
        t.notOk(sourceCache._timers[id]);
        t.notOk(sourceCache._cache.has(tileID));

        sourceCache._addTile(tileID);

        t.ok(sourceCache._timers[id]);
        t.notOk(sourceCache._cache.has(tileID));

        sourceCache._removeTile(tileID.key);

        t.notOk(sourceCache._timers[id]);
        t.ok(sourceCache._cache.has(tileID));

        sourceCache._addTile(tileID);

        t.ok(sourceCache._timers[id]);
        t.notOk(sourceCache._cache.has(tileID));

        t.end();
    });

    t.test('does not reuse wrapped tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        }).on('dataloading', () => { add++; });

        const t1 = sourceCache._addTile(tileID);
        const t2 = sourceCache._addTile(new OverscaledTileID(0, 1, 0, 0, 0));

        t.equal(load, 2);
        t.equal(add, 2);
        t.notEqual(t1, t2);

        t.end();
    });

    t.end();
});

test('SourceCache#removeTile', (t) => {
    t.test('removes tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({});
        sourceCache._addTile(tileID);
        sourceCache.on('data', ()=> {
            sourceCache._removeTile(tileID.key);
            t.notOk(sourceCache._tiles[tileID.key]);
            t.end();
        });
    });

    t.test('caches (does not unload) loaded tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        const sourceCache = createSourceCache({
            loadTile: function(tile) {
                tile.state = 'loaded';
            },
            unloadTile: function() {
                t.fail();
            }
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        t.end();
    });

    t.test('aborts and unloads unfinished tile', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache({
            abortTile: function(tile) {
                t.deepEqual(tile.tileID, tileID);
                abort++;
            },
            unloadTile: function(tile) {
                t.deepEqual(tile.tileID, tileID);
                unload++;
            }
        });

        sourceCache._addTile(tileID);
        sourceCache._removeTile(tileID.key);

        t.equal(abort, 1);
        t.equal(unload, 1);

        t.end();
    });

    t.test('_tileLoaded after _removeTile skips tile.added', (t) => {
        const tileID = new OverscaledTileID(0, 0, 0, 0, 0);

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.added = t.notOk();
                sourceCache._removeTile(tileID.key);
                callback();
            }
        });
        sourceCache.map = { painter: { crossTileSymbolIndex: "", tileExtentVAO: {} } };

        sourceCache._addTile(tileID);

        t.end();
    });

    t.end();
});

test('SourceCache / Source lifecycle', (t) => {
    t.test('does not fire load or change before source load event', (t) => {
        const sourceCache = createSourceCache({noLoad: true})
            .on('data', t.fail);
        sourceCache.onAdd();
        setTimeout(t.end, 1);
    });

    t.test('forward load event', (t) => {
        const sourceCache = createSourceCache({}).on('data', (e)=>{
            if (e.sourceDataType === 'metadata') t.end();
        });
        sourceCache.onAdd();
    });

    t.test('forward change event', (t) => {
        const sourceCache = createSourceCache().on('data', (e)=>{
            if (e.sourceDataType === 'metadata') t.end();
        });
        sourceCache.onAdd();
        sourceCache.getSource().fire(new Event('data'));
    });

    t.test('forward error event', (t) => {
        const sourceCache = createSourceCache({ error: 'Error loading source' }).on('error', (err) => {
            t.equal(err.error, 'Error loading source');
            t.end();
        });
        sourceCache.onAdd();
    });

    t.test('suppress 404 errors', (t) => {
        const sourceCache = createSourceCache({status: 404, message: 'Not found'})
            .on('error', t.fail);
        sourceCache.onAdd();
        t.end();
    });

    t.test('loaded() true after source error', (t) => {
        const sourceCache = createSourceCache({ error: 'Error loading source' }).on('error', () => {
            t.ok(sourceCache.loaded());
            t.end();
        });
        sourceCache.onAdd();
    });

    t.test('loaded() true after tile error', (t)=>{
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        const sourceCache = createSourceCache({
            loadTile: function (tile, callback) {
                callback("error");
            }
        }).on('data', (e)=>{
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
            }
        }).on('error', ()=>{
            t.true(sourceCache.loaded());
            t.end();
        });


        sourceCache.onAdd();
    });

    t.test('reloads tiles after a data event where source is updated', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const expected = [ new OverscaledTileID(0, 0, 0, 0, 0).key, new OverscaledTileID(0, 0, 0, 0, 0).key ];
        t.plan(expected.length);

        const sourceCache = createSourceCache({
            loadTile: function (tile, callback) {
                t.equal(tile.tileID.key, expected.shift());
                tile.loaded = true;
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });

        sourceCache.onAdd();
    });

    t.test('does not reload errored tiles', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const sourceCache = createSourceCache({
            loadTile: function (tile, callback) {
                // this transform will try to load the four tiles at z1 and a single z0 tile
                // we only expect _reloadTile to be called with the 'loaded' z0 tile
                tile.state = tile.tileID.canonical.z === 1 ? 'errored' : 'loaded';
                callback();
            }
        });

        const reloadTileSpy = t.spy(sourceCache, '_reloadTile');
        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire(new Event('data', {dataType: 'source', sourceDataType: 'content'}));
            }
        });
        sourceCache.onAdd();
        // we expect the source cache to have five tiles, but only to have reloaded one
        t.equal(Object.keys(sourceCache._tiles).length, 5);
        t.ok(reloadTileSpy.calledOnce);

        t.end();
    });

    t.end();
});

test('SourceCache#update', (t) => {
    t.test('loads no tiles if used is false', (t) => {
        const transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 0;

        const sourceCache = createSourceCache({}, false);
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), []);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('loads covering tiles', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({});
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 0, 0, 0, 0).key]);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('respects Source#hasTile method if it is present', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const sourceCache = createSourceCache({
            hasTile: (coord) => (coord.canonical.x !== 0)
        });
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds().sort(), [
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 1, 1).key
                ].sort());
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('removes unused tiles', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({
            loadTile: (tile, callback)=>{
                tile.state = 'loaded';
                callback(null);
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 0, 0, 0, 0).key]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new OverscaledTileID(1, 0, 1, 1, 1).key,
                    new OverscaledTileID(1, 0, 1, 0, 1).key,
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 0, 0).key
                ]);
                t.end();
            }
        });

        sourceCache.onAdd();
    });


    t.test('retains parent tiles for pending children', (t) => {
        const transform = new Transform();
        transform._test = 'retains';
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = (tile.tileID.key === new OverscaledTileID(0, 0, 0, 0, 0).key) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 0, 0, 0, 0).key]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new OverscaledTileID(0, 0, 0, 0, 0).key,
                    new OverscaledTileID(1, 0, 1, 1, 1).key,
                    new OverscaledTileID(1, 0, 1, 0, 1).key,
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 0, 0).key
                ]);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('retains parent tiles for pending children (wrapped)', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        transform.center = new LngLat(360, 0);

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = (tile.tileID.key === new OverscaledTileID(0, 1, 0, 0, 0).key) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new OverscaledTileID(0, 1, 0, 0, 0).key]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new OverscaledTileID(0, 1, 0, 0, 0).key,
                    new OverscaledTileID(1, 1, 1, 1, 1).key,
                    new OverscaledTileID(1, 1, 1, 0, 1).key,
                    new OverscaledTileID(1, 1, 1, 1, 0).key,
                    new OverscaledTileID(1, 1, 1, 0, 0).key
                ]);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('retains covered child tiles while parent tile is fading in', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 2;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [
                    new OverscaledTileID(2, 0, 2, 2, 2).key,
                    new OverscaledTileID(2, 0, 2, 1, 2).key,
                    new OverscaledTileID(2, 0, 2, 2, 1).key,
                    new OverscaledTileID(2, 0, 2, 1, 1).key
                ]);

                transform.zoom = 0;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getRenderableIds().length, 5);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('retains a parent tile for fading even if a tile is partially covered by children', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(100);
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                transform.zoom = 2;
                sourceCache.update(transform);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.equal(sourceCache._coveredTiles[(new OverscaledTileID(0, 0, 0, 0, 0).key)], true);
                t.end();
            }
        });
        sourceCache.onAdd();
    });


    t.test('retains children for fading when tile.fadeEndTime is not set', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;


        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Date.now();
                tile.state = 'loaded';
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                transform.zoom = 0;
                sourceCache.update(transform);

                t.equal(sourceCache.getRenderableIds().length, 5, 'retains 0/0/0 and its four children');
                t.end();
            }
        });
        sourceCache.onAdd();
    });


    t.test('retains children when tile.fadeEndTime is in the future', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const fadeTime = 100;

        const start = Date.now();
        let time = start;
        t.stub(browser, 'now').callsFake(() => time);

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = browser.now();
                tile.state = 'loaded';
                tile.fadeEndTime = browser.now() + fadeTime;
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                // load children
                sourceCache.update(transform);

                transform.zoom = 0;
                sourceCache.update(transform);

                t.equal(sourceCache.getRenderableIds().length, 5, 'retains 0/0/0 and its four children');

                time = start + 98;
                sourceCache.update(transform);
                t.equal(sourceCache.getRenderableIds().length, 5, 'retains 0/0/0 and its four children');

                time = start + fadeTime + 1;
                sourceCache.update(transform);
                t.equal(sourceCache.getRenderableIds().length, 1, 'drops children after fading is complete');
                t.end();
            }
        });

        sourceCache.onAdd();
    });


    t.test('retains overscaled loaded children', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;

        // use slightly offset center so that sort order is better defined
        transform.center = new LngLat(-0.001, 0.001);


        const sourceCache = createSourceCache({
            reparseOverscaled: true,
            loadTile: function(tile, callback) {
                tile.state = tile.tileID.overscaledZ === 16 ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getRenderableIds(), [
                    new OverscaledTileID(16, 0, 16, 8192, 8192).key,
                    new OverscaledTileID(16, 0, 16, 8191, 8192).key,
                    new OverscaledTileID(16, 0, 16, 8192, 8191).key,
                    new OverscaledTileID(16, 0, 16, 8191, 8191).key
                ]);

                transform.zoom = 15;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getRenderableIds(), [
                    new OverscaledTileID(16, 0, 16, 8192, 8192).key,
                    new OverscaledTileID(16, 0, 16, 8191, 8192).key,
                    new OverscaledTileID(16, 0, 16, 8192, 8191).key,
                    new OverscaledTileID(16, 0, 16, 8191, 8191).key
                ]);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('reassigns tiles for large jumps in longitude', (t) => {

        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({});
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                transform.center = new LngLat(360, 0);
                const tileID = new OverscaledTileID(0, 1, 0, 0, 0);
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [tileID.key]);
                const tile = sourceCache.getTile(tileID);

                transform.center = new LngLat(0, 0);
                const wrappedTileID = new OverscaledTileID(0, 0, 0, 0, 0);
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [wrappedTileID.key]);
                t.equal(sourceCache.getTile(wrappedTileID), tile);
                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.end();
});

test('SourceCache#_updateRetainedTiles', (t)=> {

    t.test('loads ideal tiles if they exist', (t)=>{
        const stateCache = {};
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = stateCache[tile.tileID.key] || 'errored';
                callback();
            }
        });

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const idealTile = new OverscaledTileID(1, 0, 1, 1, 1);
        stateCache[idealTile.key] = 'loaded';
        sourceCache._updateRetainedTiles([idealTile], 1);
        t.ok(getTileSpy.notCalled);
        t.deepEqual(sourceCache.getIds(), [idealTile.key]);
        t.end();
    });

    t.test('retains all loaded children ', (t) => {
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
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

        const retained = sourceCache._updateRetainedTiles([idealTile], 3);
        t.deepEqual(Object.keys(retained), [
            // parents are requested because ideal ideal tile is not completely covered by
            // loaded child tiles
            new OverscaledTileID(0, 0, 0, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 1),
            idealTile
        ].concat(loadedChildren).map(t=> String(t.key)));

        t.end();
    });

    t.test('adds parent tile if ideal tile errors and no child tiles are loaded', (t)=>{
        const stateCache = {};
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = stateCache[tile.tileID.key] || 'errored';
                callback();
            }
        });

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');

        const idealTiles = [new OverscaledTileID(1, 0, 1, 1, 1), new OverscaledTileID(1, 0, 1, 0, 1)];
        stateCache[idealTiles[0].key] = 'loaded';
        const retained = sourceCache._updateRetainedTiles(idealTiles, 1);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // when child tiles aren't found, check and request parent tile
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        // retained tiles include all ideal tiles and any parents that were loaded to cover
        // non-existant tiles
        t.deepEqual(retained, {
            // parent
            '0': new OverscaledTileID(0, 0, 0, 0, 0),
            //  1/0/1
            '65': new OverscaledTileID(1, 0, 1, 0, 1),
            // 1/1/1
            '97': new OverscaledTileID(1, 0, 1, 1, 1)
        });
        addTileSpy.restore();
        getTileSpy.restore();
        t.end();
    });

    t.test('don\'t use wrong parent tile', (t)=> {
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'errored';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile);
        sourceCache._tiles[idealTile.key].state = 'errored';

        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key] = new Tile(new OverscaledTileID(1, 0, 1, 1, 0));
        sourceCache._tiles[new OverscaledTileID(1, 0, 1, 1, 0).key].state = 'loaded';

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');

        sourceCache._updateRetainedTiles([idealTile], 2);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0), // not found
            new OverscaledTileID(0, 0, 0, 0, 0)  // not found
        ]);

        t.deepEqual(addTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // ideal tile
            new OverscaledTileID(2, 0, 2, 0, 0),
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0), // not found
            new OverscaledTileID(0, 0, 0, 0, 0)  // not found
        ]);

        addTileSpy.restore();
        getTileSpy.restore();
        t.end();
    });


    t.test('use parent tile when ideal tile is not loaded', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 1);
        sourceCache._tiles[idealTile.key] = new Tile(idealTile);
        sourceCache._tiles[idealTile.key].state = 'loading';
        sourceCache._tiles['0'] = new Tile(new OverscaledTileID(0, 0, 0, 0, 0));
        sourceCache._tiles['0'].state = 'loaded';

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');

        const retained = sourceCache._updateRetainedTiles([idealTile], 1);

        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // parents
            new OverscaledTileID(0, 0, 0, 0, 0), // found
        ]);

        t.deepEqual(retained, {
            // parent of ideal tile 0/0/0
            '0' : new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id 1/0/1
            '65' : new OverscaledTileID(1, 0, 1, 0, 1)
        }, 'retain ideal and parent tile when ideal tiles aren\'t loaded');

        addTileSpy.resetHistory();
        getTileSpy.resetHistory();

        // now make sure we don't retain the parent tile when the ideal tile is loaded
        sourceCache._tiles[idealTile.key].state = 'loaded';
        const retainedLoaded = sourceCache._updateRetainedTiles([idealTile], 1);

        t.ok(getTileSpy.notCalled);
        t.deepEqual(retainedLoaded, {
            // only ideal tile retained
            '65' : new OverscaledTileID(1, 0, 1, 0, 1)
        }, 'only retain ideal tiles when they\'re all loaded');

        addTileSpy.restore();
        getTileSpy.restore();


        t.end();
    });

    t.test('don\'t load parent if all immediate children are loaded', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });

        const idealTile = new OverscaledTileID(2, 0, 2, 1, 1);
        const loadedTiles = [new OverscaledTileID(3, 0, 3, 2, 2), new OverscaledTileID(3, 0, 3, 3, 2), new OverscaledTileID(3, 0, 3, 2, 3), new OverscaledTileID(3, 0, 3, 3, 3)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);
        // parent tile isn't requested because all covering children are loaded
        t.deepEqual(getTileSpy.getCalls(), []);
        t.deepEqual(Object.keys(retained), [idealTile.key].concat(loadedTiles.map(t=>t.key)));
        t.end();

    });

    t.test('prefer loaded child tiles to parent tiles', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new OverscaledTileID(1, 0, 1, 0, 0);
        const loadedTiles = [new OverscaledTileID(0, 0, 0, 0, 0), new OverscaledTileID(2, 0, 2, 0, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = t.spy(sourceCache, 'getTile');
        let retained = sourceCache._updateRetainedTiles([idealTile], 1);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // parent
            new OverscaledTileID(0, 0, 0, 0, 0)
        ]);

        t.deepEqual(retained, {
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '0' : new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id (1, 0, 0)
            '1' : new OverscaledTileID(1, 0, 1, 0, 0),
            // loaded child tile (2, 0, 0)
            '2': new OverscaledTileID(2, 0, 2, 0, 0)
        }, 'retains children and parent when ideal tile is partially covered by a loaded child tile');

        getTileSpy.restore();
        // remove child tile and check that it only uses parent tile
        delete sourceCache._tiles['2'];
        retained = sourceCache._updateRetainedTiles([idealTile], 1);

        t.deepEqual(retained, {
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '0' : new OverscaledTileID(0, 0, 0, 0, 0),
            // ideal tile id (1, 0, 0)
            '1' : new OverscaledTileID(1, 0, 1, 0, 0)
        }, 'only retains parent tile if no child tiles are loaded');

        t.end();
    });

    t.test('don\'t use tiles below minzoom', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            minzoom: 2
        });
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);
        const loadedTiles = [new OverscaledTileID(1, 0, 1, 0, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [], 'doesn\'t request parent tiles bc they are lower than minzoom');

        t.deepEqual(retained, {
            // ideal tile id (2, 0, 0)
            '2' : new OverscaledTileID(2, 0, 2, 0, 0)
        }, 'doesn\'t retain parent tiles below minzoom');

        getTileSpy.restore();
        t.end();
    });

    t.test('use overzoomed tile above maxzoom', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            maxzoom: 2
        });
        const idealTile = new OverscaledTileID(2, 0, 2, 0, 0);

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // overzoomed child
            new OverscaledTileID(3, 0, 2, 0, 0),
            // parents
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ], 'doesn\'t request childtiles above maxzoom');

        t.deepEqual(retained, {
            // ideal tile id (2, 0, 0)
            '2' : new OverscaledTileID(2, 0, 2, 0, 0)
        }, 'doesn\'t retain child tiles above maxzoom');

        getTileSpy.restore();
        t.end();
    });

    t.test('dont\'t ascend multiple times if a tile is not found', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTiles = [new OverscaledTileID(8, 0, 8, 0, 0), new OverscaledTileID(8, 0, 8, 1, 0)];

        const getTileSpy = t.spy(sourceCache, 'getTile');
        sourceCache._updateRetainedTiles(idealTiles, 8);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // parent tile ascent
            new OverscaledTileID(7, 0, 7, 0, 0),
            new OverscaledTileID(6, 0, 6, 0, 0),
            new OverscaledTileID(5, 0, 5, 0, 0),
            new OverscaledTileID(4, 0, 4, 0, 0),
            new OverscaledTileID(3, 0, 3, 0, 0),
            new OverscaledTileID(2, 0, 2, 0, 0),
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(0, 0, 0, 0, 0),
        ], 'only ascends up a tile pyramid once');

        getTileSpy.resetHistory();

        const loadedTiles = [new OverscaledTileID(4, 0, 4, 0, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        sourceCache._updateRetainedTiles(idealTiles, 8);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // parent tile ascent
            new OverscaledTileID(7, 0, 7, 0, 0),
            new OverscaledTileID(6, 0, 6, 0, 0),
            new OverscaledTileID(5, 0, 5, 0, 0),
            new OverscaledTileID(4, 0, 4, 0, 0), // tile is loaded, stops ascent
        ], 'ascent stops if a loaded parent tile is found');

        getTileSpy.restore();
        t.end();
    });

    t.test('adds correct leaded parent tiles for overzoomed tiles', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            },
            maxzoom: 7
        });
        const loadedTiles = [new OverscaledTileID(7, 0, 7, 0, 0), new OverscaledTileID(7, 0, 7, 1, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.key] = new Tile(t);
            sourceCache._tiles[t.key].state = 'loaded';
        });

        const idealTiles = [new OverscaledTileID(8, 0, 7, 0, 0), new OverscaledTileID(8, 0, 7, 1, 0)];
        const retained = sourceCache._updateRetainedTiles(idealTiles, 8);

        t.deepEqual(Object.keys(retained), [
            new OverscaledTileID(7, 0, 7, 0, 0).key,
            new OverscaledTileID(8, 0, 7, 0, 0).key,
            new OverscaledTileID(7, 0, 7, 1, 0).key,
            new OverscaledTileID(8, 0, 7, 1, 0).key
        ]);

        t.end();
    });

    t.end();
});

test('SourceCache#clearTiles', (t) => {
    t.test('unloads tiles', (t) => {
        const coord = new OverscaledTileID(0, 0, 0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache({
            abortTile: function(tile) {
                t.deepEqual(tile.tileID, coord);
                abort++;
            },
            unloadTile: function(tile) {
                t.deepEqual(tile.tileID, coord);
                unload++;
            }
        });
        sourceCache.onAdd();

        sourceCache._addTile(coord);
        sourceCache.clearTiles();

        t.equal(abort, 1);
        t.equal(unload, 1);

        t.end();
    });

    t.end();
});

test('SourceCache#tilesIn', (t) => {
    t.test('graceful response before source loaded', (t) => {
        const sourceCache = createSourceCache({ noLoad: true });
        sourceCache.onAdd();
        t.same(sourceCache.tilesIn([
            new Coordinate(0.5, 0.25, 1),
            new Coordinate(1.5, 0.75, 1)
        ]), []);

        t.end();
    });

    t.test('regular tiles', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                tile.additionalRadius = 0;
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new OverscaledTileID(1, 0, 1, 1, 1).key,
                    new OverscaledTileID(1, 0, 1, 0, 1).key,
                    new OverscaledTileID(1, 0, 1, 1, 0).key,
                    new OverscaledTileID(1, 0, 1, 0, 0).key
                ]);

                const tiles = sourceCache.tilesIn([
                    new Coordinate(0.5, 0.25, 1),
                    new Coordinate(1.5, 0.75, 1)
                ], 1);

                tiles.sort((a, b) => { return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x; });
                tiles.forEach((result) => { delete result.tile.uid; });

                t.equal(tiles[0].tile.tileID.key, 1);
                t.equal(tiles[0].tile.tileSize, 512);
                t.equal(tiles[0].scale, 1);
                t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

                t.equal(tiles[1].tile.tileID.key, 33);
                t.equal(tiles[1].tile.tileSize, 512);
                t.equal(tiles[1].scale, 1);
                t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('reparsed overscaled tiles', (t) => {
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                tile.additionalRadius = 0;
                callback();
            },
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const transform = new Transform();
                transform.resize(512, 512);
                transform.zoom = 2.0;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new OverscaledTileID(2, 0, 2, 1, 1).key,
                    new OverscaledTileID(2, 0, 2, 0, 1).key,
                    new OverscaledTileID(2, 0, 2, 1, 0).key,
                    new OverscaledTileID(2, 0, 2, 0, 0).key
                ]);

                const tiles = sourceCache.tilesIn([
                    new Coordinate(0.5, 0.25, 1),
                    new Coordinate(1.5, 0.75, 1)
                ], 1);

                tiles.sort((a, b) => { return a.tile.tileID.canonical.x - b.tile.tileID.canonical.x; });
                tiles.forEach((result) => { delete result.tile.uid; });

                t.equal(tiles[0].tile.tileID.key, 2);
                t.equal(tiles[0].tile.tileSize, 1024);
                t.equal(tiles[0].scale, 1);
                t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

                t.equal(tiles[1].tile.tileID.key, 34);
                t.equal(tiles[1].tile.tileSize, 1024);
                t.equal(tiles[1].scale, 1);
                t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.test('overscaled tiles', (t) => {
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) { tile.state = 'loaded'; callback(); },
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                const transform = new Transform();
                transform.resize(512, 512);
                transform.zoom = 2.0;
                sourceCache.update(transform);


                t.end();
            }
        });
        sourceCache.onAdd();
    });

    t.end();
});

test('SourceCache#loaded (no errors)', (t) => {
    const sourceCache = createSourceCache({
        loadTile: function(tile, callback) {
            tile.state = 'loaded';
            callback();
        }
    });

    sourceCache.on('data', (e) => {
        if (e.sourceDataType === 'metadata') {
            const coord = new OverscaledTileID(0, 0, 0, 0, 0);
            sourceCache._addTile(coord);

            t.ok(sourceCache.loaded());
            t.end();
        }
    });
    sourceCache.onAdd();
});

test('SourceCache#loaded (with errors)', (t) => {
    const sourceCache = createSourceCache({
        loadTile: function(tile) {
            tile.state = 'errored';
        }
    });

    sourceCache.on('data', (e) => {
        if (e.sourceDataType === 'metadata') {
            const coord = new OverscaledTileID(0, 0, 0, 0, 0);
            sourceCache._addTile(coord);

            t.ok(sourceCache.loaded());
            t.end();
        }
    });
    sourceCache.onAdd();
});

test('SourceCache#getIds (ascending order by zoom level)', (t) => {
    const ids = [
        new OverscaledTileID(0, 0, 0, 0, 0),
        new OverscaledTileID(3, 0, 3, 0, 0),
        new OverscaledTileID(1, 0, 1, 0, 0),
        new OverscaledTileID(2, 0, 2, 0, 0)
    ];

    const sourceCache = createSourceCache({});
    sourceCache.transform = new Transform();
    for (let i = 0; i < ids.length; i++) {
        sourceCache._tiles[ids[i].key] = { tileID: ids[i] };
    }
    t.deepEqual(sourceCache.getIds(), [
        new OverscaledTileID(0, 0, 0, 0, 0).key,
        new OverscaledTileID(1, 0, 1, 0, 0).key,
        new OverscaledTileID(2, 0, 2, 0, 0).key,
        new OverscaledTileID(3, 0, 3, 0, 0).key
    ]);
    t.end();
    sourceCache.onAdd();
});


test('SourceCache#findLoadedParent', (t) => {

    t.test('adds from previously used tiles (sourceCache._tiles)', (t) => {
        const sourceCache = createSourceCache({});
        sourceCache.onAdd();
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = {
            tileID: new OverscaledTileID(1, 0, 1, 0, 0),
            hasData: function() { return true; }
        };

        sourceCache._tiles[tile.tileID.key] = tile;

        t.equal(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0), undefined);
        t.deepEqual(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0), tile);
        t.end();
    });

    t.test('retains parents', (t) => {
        const sourceCache = createSourceCache({});
        sourceCache.onAdd();
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = new Tile(new OverscaledTileID(1, 0, 1, 0, 0), 512, 22);
        sourceCache._cache.add(tile.tileID, tile);

        t.equal(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 3, 3), 0), undefined);
        t.equal(sourceCache.findLoadedParent(new OverscaledTileID(2, 0, 2, 0, 0), 0), tile);
        t.equal(sourceCache._cache.order.length, 1);

        t.end();
    });

    t.end();
});

test('SourceCache#reload', (t) => {
    t.test('before loaded', (t) => {
        const sourceCache = createSourceCache({ noLoad: true });
        sourceCache.onAdd();

        t.doesNotThrow(() => {
            sourceCache.reload();
        }, null, 'reload ignored gracefully');

        t.end();
    });

    t.end();
});

test('SourceCache reloads expiring tiles', (t) => {
    t.test('calls reloadTile when tile expires', (t) => {
        const coord = new OverscaledTileID(1, 0, 1, 0, 1, 0, 0);

        const expiryDate = new Date();
        expiryDate.setMilliseconds(expiryDate.getMilliseconds() + 50);
        const sourceCache = createSourceCache({ expires: expiryDate });

        sourceCache._reloadTile = (id, state) => {
            t.equal(state, 'expired');
            t.end();
        };

        sourceCache._addTile(coord);
    });

    t.end();
});

test('SourceCache sets max cache size correctly', (t) => {
    t.test('sets cache size based on 512 tiles', (t) => {
        const sourceCache = createSourceCache({
            tileSize: 256
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 3 * 3 * 5
        t.equal(sourceCache._cache.max, 45);
        t.end();
    });

    t.test('sets cache size based on 256 tiles', (t) => {
        const sourceCache = createSourceCache({
            tileSize: 512
        });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        // Expect max size to be ((512 / tileSize + 1) ^ 2) * 5 => 2 * 2 * 5
        t.equal(sourceCache._cache.max, 20);
        t.end();
    });

    t.end();
});
