'use strict';

const test = require('mapbox-gl-js-test').test;
const SourceCache = require('../../../src/source/source_cache');
const Source = require('../../../src/source/source');
const Tile = require('../../../src/source/tile');
const TileCoord = require('../../../src/source/tile_coord');
const Transform = require('../../../src/geo/transform');
const LngLat = require('../../../src/geo/lng_lat');
const Coordinate = require('../../../src/geo/coordinate');
const Evented = require('../../../src/util/evented');
const util = require('../../../src/util/util');

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
            util.extend(this, sourceOptions);
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
                this.fire('error', { error: sourceOptions.error });
            } else {
                this.fire('data', {dataType: 'source', sourceDataType: 'metadata'});
            }
        }
        abortTile() {}
        unloadTile() {}
        serialize() {}
    }
    const source = new SourceMock();

    return source;
}

Source.setType('mock-source-type', MockSourceType);

function createSourceCache(options, used) {
    const sc = new SourceCache('id', util.extend({
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
        const coord = new TileCoord(0, 0, 0);
        const sourceCache = createSourceCache({
            loadTile: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        sourceCache.onAdd();
        sourceCache._addTile(coord);
    });

    t.test('adds tile when uncached', (t) => {
        const coord = new TileCoord(0, 0, 0);
        const sourceCache = createSourceCache({}).on('dataloading', (data) => {
            t.deepEqual(data.tile.coord, coord);
            t.equal(data.tile.uses, 1);
            t.end();
        });
        sourceCache.onAdd();
        sourceCache._addTile(coord);
    });

    t.test('uses cached tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
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
        sourceCache._addTile(coord);
        sourceCache._removeTile(coord.id);
        sourceCache._addTile(coord);

        t.equal(load, 1);
        t.equal(add, 1);

        t.end();
    });

    t.test('moves timers when adding tile from cache', (t) => {
        const coord = new TileCoord(0, 0, 0);
        const time = new Date();
        time.setSeconds(time.getSeconds() + 5);

        const sourceCache = createSourceCache();
        sourceCache._setTileReloadTimer = (id) => {
            sourceCache._timers[id] = setTimeout(() => {}, 0);
        };
        sourceCache._setCacheInvalidationTimer = (id) => {
            sourceCache._cacheTimers[id] = setTimeout(() => {}, 0);
        };
        sourceCache._loadTile = (tile, callback) => {
            tile.state = 'loaded';
            tile.getExpiryTimeout = () => time;
            sourceCache._setTileReloadTimer(coord.id, tile);
            callback();
        };

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const id = coord.id;
        t.notOk(sourceCache._timers[id]);
        t.notOk(sourceCache._cacheTimers[id]);

        sourceCache._addTile(coord);

        t.ok(sourceCache._timers[id]);
        t.notOk(sourceCache._cacheTimers[id]);

        sourceCache._removeTile(coord.id);

        t.notOk(sourceCache._timers[id]);
        t.ok(sourceCache._cacheTimers[id]);

        sourceCache._addTile(coord);

        t.ok(sourceCache._timers[id]);
        t.notOk(sourceCache._cacheTimers[id]);

        t.end();
    });

    t.test('does not reuse wrapped tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        }).on('dataloading', () => { add++; });

        const t1 = sourceCache._addTile(coord);
        const t2 = sourceCache._addTile(new TileCoord(0, 0, 0, 1));

        t.equal(load, 2);
        t.equal(add, 2);
        t.notEqual(t1, t2);

        t.end();
    });

    t.end();
});

test('SourceCache#removeTile', (t) => {
    t.test('removes tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
        const sourceCache = createSourceCache({});
        sourceCache._addTile(coord);
        sourceCache.on('data', ()=> {
            sourceCache._removeTile(coord.id);
            t.notOk(sourceCache._tiles[coord.id]);
            t.end();
        });
    });

    t.test('caches (does not unload) loaded tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
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

        sourceCache._addTile(coord);
        sourceCache._removeTile(coord.id);

        t.end();
    });

    t.test('aborts and unloads unfinished tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache({
            abortTile: function(tile) {
                t.deepEqual(tile.coord, coord);
                abort++;
            },
            unloadTile: function(tile) {
                t.deepEqual(tile.coord, coord);
                unload++;
            }
        });

        sourceCache._addTile(coord);
        sourceCache._removeTile(coord.id);

        t.equal(abort, 1);
        t.equal(unload, 1);

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
        sourceCache.getSource().fire('data');
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

        const expected = [ new TileCoord(0, 0, 0).id, new TileCoord(0, 0, 0).id ];
        t.plan(expected.length);

        const sourceCache = createSourceCache({
            loadTile: function (tile, callback) {
                t.equal(tile.coord.id, expected.shift());
                tile.loaded = true;
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                sourceCache.getSource().fire('data', {dataType: 'source', sourceDataType: 'content'});
            }
        });

        sourceCache.onAdd();
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
                t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);
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
            hasTile: (coord) => (coord.x !== 0)
        });
        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds().sort(), [
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 1, 1).id
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
                t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new TileCoord(1, 1, 1).id,
                    new TileCoord(1, 0, 1).id,
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 0, 0).id
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
                tile.state = (tile.coord.id === new TileCoord(0, 0, 0).id) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new TileCoord(0, 0, 0).id,
                    new TileCoord(1, 1, 1).id,
                    new TileCoord(1, 0, 1).id,
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 0, 0).id
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
                tile.state = (tile.coord.id === new TileCoord(0, 0, 0, 1).id) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0, 1).id]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new TileCoord(0, 0, 0, 1).id,
                    new TileCoord(1, 1, 1, 1).id,
                    new TileCoord(1, 0, 1, 1).id,
                    new TileCoord(1, 1, 0, 1).id,
                    new TileCoord(1, 0, 0, 1).id
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
                    new TileCoord(2, 2, 2).id,
                    new TileCoord(2, 1, 2).id,
                    new TileCoord(2, 2, 1).id,
                    new TileCoord(2, 1, 1).id
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

                t.equal(sourceCache._coveredTiles[(new TileCoord(0, 0, 0).id)], true);
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

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Date.now();
                tile.state = 'loaded';
                tile.fadeEndTime = Date.now() + 100;
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
                setTimeout(() => {
                    sourceCache.update(transform);
                    t.equal(sourceCache.getRenderableIds().length, 1, 'drops children after fading is complete');
                    t.end();
                }, 100);
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
                tile.state = tile.coord.z === 16 ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getRenderableIds(), [
                    new TileCoord(16, 8192, 8192, 0).id,
                    new TileCoord(16, 8191, 8192, 0).id,
                    new TileCoord(16, 8192, 8191, 0).id,
                    new TileCoord(16, 8191, 8191, 0).id
                ]);

                transform.zoom = 15;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getRenderableIds(), [
                    new TileCoord(16, 8192, 8192, 0).id,
                    new TileCoord(16, 8191, 8192, 0).id,
                    new TileCoord(16, 8192, 8191, 0).id,
                    new TileCoord(16, 8191, 8191, 0).id
                ]);
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
                tile.state = stateCache[tile.coord.id] || 'errored';
                callback();
            }
        });

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const idealTile = new TileCoord(1, 1, 1);
        stateCache[idealTile.id] = 'loaded';
        sourceCache._updateRetainedTiles([idealTile], 1);
        t.ok(getTileSpy.notCalled);
        t.deepEqual(sourceCache.getIds(), [idealTile.id]);
        t.end();
    });

    t.test('adds parent tile if ideal tile errors and no child tiles are loaded', (t)=>{
        const stateCache = {};
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = stateCache[tile.coord.id] || 'errored';
                callback();
            }
        });

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');

        const idealTiles = [new TileCoord(1, 1, 1), new TileCoord(1, 0, 1)];
        stateCache[idealTiles[0].id] = 'loaded';
        const retained = sourceCache._updateRetainedTiles(idealTiles, 1);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // checks all child tiles to see if they're loaded before loading parent
            new TileCoord(2, 0, 2),
            new TileCoord(2, 1, 2),
            new TileCoord(2, 0, 3),
            new TileCoord(2, 1, 3),

            // when child tiles aren't found, check and request parent tile
            new TileCoord(0, 0, 0)
        ]);

        // retained tiles include all ideal tiles and any parents that were loaded to cover
        // non-existant tiles
        t.deepEqual(retained, {
            // parent
            '0': true,
            //  1/0/1
            '65': true,
            // 1/1/1
            '97': true
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

        const idealTile = new TileCoord(2, 0, 0);
        sourceCache._tiles[idealTile.id] = new Tile(idealTile);
        sourceCache._tiles[idealTile.id].state = 'errored';

        sourceCache._tiles[new TileCoord(1, 1, 0).id] = new Tile(new TileCoord(1, 1, 0));
        sourceCache._tiles[new TileCoord(1, 1, 0).id].state = 'loaded';

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');

        sourceCache._updateRetainedTiles([idealTile], 2);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // all children
            new TileCoord(3, 0, 0), // not found
            new TileCoord(3, 1, 0), // not found
            new TileCoord(3, 0, 1), // not found
            new TileCoord(3, 1, 1), // not found
            // parents
            new TileCoord(1, 0, 0), // not found
            new TileCoord(0, 0, 0)  // not found
        ]);

        t.deepEqual(addTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // ideal tile
            new TileCoord(2, 0, 0),
            // parents
            new TileCoord(1, 0, 0), // not found
            new TileCoord(0, 0, 0)  // not found
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
        const idealTile = new TileCoord(1, 0, 1);
        sourceCache._tiles[idealTile.id] = new Tile(idealTile);
        sourceCache._tiles[idealTile.id].state = 'loading';
        sourceCache._tiles['0'] = new Tile(0, 0, 0);
        sourceCache._tiles['0'].state = 'loaded';

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');

        const retained = sourceCache._updateRetainedTiles([idealTile], 1);

        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // all children
            new TileCoord(2, 0, 2), // not found
            new TileCoord(2, 1, 2), // not found
            new TileCoord(2, 0, 3), // not found
            new TileCoord(2, 1, 3), // not found
            // parents
            new TileCoord(0, 0, 0), // found
        ]);

        t.deepEqual(retained, {
            // parent of ideal tile 0/0/0
            '0' : true,
            // ideal tile id 1/0/1
            '65' : true
        }, 'retain ideal and parent tile when ideal tiles aren\'t loaded');

        addTileSpy.reset();
        getTileSpy.reset();

        // now make sure we don't retain the parent tile when the ideal tile is loaded
        sourceCache._tiles[idealTile.id].state = 'loaded';
        const retainedLoaded = sourceCache._updateRetainedTiles([idealTile], 1);

        t.ok(getTileSpy.notCalled);
        t.deepEqual(retainedLoaded, {
            // only ideal tile retained
            '65' : true
        }, 'only retain ideal tiles when they\'re all loaded');

        addTileSpy.restore();
        getTileSpy.restore();


        t.end();
    });

    t.test('prefer loaded child tiles to parent tiles', (t)=>{
        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loading';
                callback();
            }
        });
        const idealTile = new TileCoord(1, 0, 0);
        const loadedTiles = [new TileCoord(0, 0, 0), new TileCoord(2, 0, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.id] = new Tile(t);
            sourceCache._tiles[t.id].state = 'loaded';
        });

        const addTileSpy = t.spy(sourceCache, '_addTile');
        const getTileSpy = t.spy(sourceCache, 'getTile');
        let retained = sourceCache._updateRetainedTiles([idealTile], 1);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // all children
            new TileCoord(2, 0, 0),
            new TileCoord(2, 1, 0),
            new TileCoord(2, 0, 1),
            new TileCoord(2, 1, 1),
            // parent
            new TileCoord(0, 0, 0)
        ]);

        t.deepEqual(retained, {
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '0' : true,
            // ideal tile id (1, 0, 0)
            '1' : true,
            // loaded child tile (2, 0, 0)
            '2': true
        }, 'retains children and parent when ideal tile is partially covered by a loaded child tile');

        addTileSpy.restore();
        getTileSpy.restore();
        // remove child tile and check that it only uses parent tile
        sourceCache._tiles['2'] = null;
        retained = sourceCache._updateRetainedTiles([idealTile], 1);

        t.deepEqual(retained, {
            // parent of ideal tile (0, 0, 0) (only partially covered by loaded child
            // tiles, so we still need to load the parent)
            '0' : true,
            // ideal tile id (1, 0, 0)
            '1' : true
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
        const idealTile = new TileCoord(2, 0, 0);
        const loadedTiles = [new TileCoord(1, 0, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.id] = new Tile(t);
            sourceCache._tiles[t.id].state = 'loaded';
        });

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // all children
            new TileCoord(3, 0, 0),
            new TileCoord(3, 1, 0),
            new TileCoord(3, 0, 1),
            new TileCoord(3, 1, 1)
        ], 'doesn\'t request parent tiles bc they are lower than minzoom');

        t.deepEqual(retained, {
            // ideal tile id (2, 0, 0)
            '2' : true
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
        const idealTile = new TileCoord(2, 0, 0);

        const getTileSpy = t.spy(sourceCache, 'getTile');
        const retained = sourceCache._updateRetainedTiles([idealTile], 2);

        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // overzoomed child
            new TileCoord(3, 0, 0),
            // parents
            new TileCoord(1, 0, 0),
            new TileCoord(0, 0, 0)
        ], 'doesn\'t request childtiles above maxzoom');

        t.deepEqual(retained, {
            // ideal tile id (2, 0, 0)
            '2' : true
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
        const idealTiles = [new TileCoord(8, 0, 0), new TileCoord(8, 1, 0)];

        const getTileSpy = t.spy(sourceCache, 'getTile');
        sourceCache._updateRetainedTiles(idealTiles, 8);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // child tiles
            new TileCoord(9, 0, 0),
            new TileCoord(9, 1, 0),
            new TileCoord(9, 0, 1),
            new TileCoord(9, 1, 1),
            // parent tile ascent
            new TileCoord(7, 0, 0),
            new TileCoord(6, 0, 0),
            new TileCoord(5, 0, 0),
            new TileCoord(4, 0, 0),
            new TileCoord(3, 0, 0),
            new TileCoord(2, 0, 0),
            new TileCoord(1, 0, 0),
            new TileCoord(0, 0, 0),
            // second ideal tile children, no parent ascent
            new TileCoord(9, 2, 0),
            new TileCoord(9, 3, 0),
            new TileCoord(9, 2, 1),
            new TileCoord(9, 3, 1)
        ], 'only ascends up a tile pyramid once');

        getTileSpy.reset();

        const loadedTiles = [new TileCoord(4, 0, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.id] = new Tile(t);
            sourceCache._tiles[t.id].state = 'loaded';
        });

        sourceCache._updateRetainedTiles(idealTiles, 8);
        t.deepEqual(getTileSpy.getCalls().map((c)=>{ return c.args[0]; }), [
            // child tiles
            new TileCoord(9, 0, 0),
            new TileCoord(9, 1, 0),
            new TileCoord(9, 0, 1),
            new TileCoord(9, 1, 1),
            // parent tile ascent
            new TileCoord(7, 0, 0),
            new TileCoord(6, 0, 0),
            new TileCoord(5, 0, 0),
            new TileCoord(4, 0, 0), // tile is loaded, stops ascent

            // second ideal tile children, no parent ascent
            new TileCoord(9, 2, 0),
            new TileCoord(9, 3, 0),
            new TileCoord(9, 2, 1),
            new TileCoord(9, 3, 1)
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
        const loadedTiles = [new TileCoord(7, 0, 0), new TileCoord(7, 1, 0)];
        loadedTiles.forEach((t)=>{
            sourceCache._tiles[t.id] = new Tile(t);
            sourceCache._tiles[t.id].state = 'loaded';
        });

        const idealTiles = [new TileCoord(8, 0, 0), new TileCoord(8, 1, 0)];
        const retained = sourceCache._updateRetainedTiles(idealTiles, 8);

        t.deepEqual(Object.keys(retained).map((k)=>{ return TileCoord.fromID(k); }), [
            new TileCoord(7, 0, 0),
            new TileCoord(8, 0, 0),
            new TileCoord(7, 1, 0),
            new TileCoord(8, 1, 0)
        ]);

        t.end();
    });

    t.end();
});

test('SourceCache#clearTiles', (t) => {
    t.test('unloads tiles', (t) => {
        const coord = new TileCoord(0, 0, 0);
        let abort = 0,
            unload = 0;

        const sourceCache = createSourceCache({
            abortTile: function(tile) {
                t.deepEqual(tile.coord, coord);
                abort++;
            },
            unloadTile: function(tile) {
                t.deepEqual(tile.coord, coord);
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
                callback();
            }
        });

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new TileCoord(1, 1, 1).id,
                    new TileCoord(1, 0, 1).id,
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 0, 0).id
                ]);

                const tiles = sourceCache.tilesIn([
                    new Coordinate(0.5, 0.25, 1),
                    new Coordinate(1.5, 0.75, 1)
                ]);

                tiles.sort((a, b) => { return a.tile.coord.x - b.tile.coord.x; });
                tiles.forEach((result) => { delete result.tile.uid; });

                t.equal(tiles[0].tile.coord.id, 1);
                t.equal(tiles[0].tile.tileSize, 512);
                t.equal(tiles[0].scale, 1);
                t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

                t.equal(tiles[1].tile.coord.id, 33);
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
            loadTile: function(tile, callback) { tile.state = 'loaded'; callback(); },
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
                    new TileCoord(2, 1, 1).id,
                    new TileCoord(2, 0, 1).id,
                    new TileCoord(2, 1, 0).id,
                    new TileCoord(2, 0, 0).id
                ]);

                const tiles = sourceCache.tilesIn([
                    new Coordinate(0.5, 0.25, 1),
                    new Coordinate(1.5, 0.75, 1)
                ]);

                tiles.sort((a, b) => { return a.tile.coord.x - b.tile.coord.x; });
                tiles.forEach((result) => { delete result.tile.uid; });

                t.equal(tiles[0].tile.coord.id, 2);
                t.equal(tiles[0].tile.tileSize, 1024);
                t.equal(tiles[0].scale, 1);
                t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

                t.equal(tiles[1].tile.coord.id, 34);
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
            const coord = new TileCoord(0, 0, 0);
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
            const coord = new TileCoord(0, 0, 0);
            sourceCache._addTile(coord);

            t.ok(sourceCache.loaded());
            t.end();
        }
    });
    sourceCache.onAdd();
});

test('SourceCache#getIds (ascending order by zoom level)', (t) => {
    const ids = [
        new TileCoord(0, 0, 0),
        new TileCoord(3, 0, 0),
        new TileCoord(1, 0, 0),
        new TileCoord(2, 0, 0)
    ];

    const sourceCache = createSourceCache({});
    sourceCache.transform = new Transform();
    for (let i = 0; i < ids.length; i++) {
        sourceCache._tiles[ids[i].id] = {};
    }
    t.deepEqual(sourceCache.getIds(), [
        new TileCoord(0, 0, 0).id,
        new TileCoord(1, 0, 0).id,
        new TileCoord(2, 0, 0).id,
        new TileCoord(3, 0, 0).id
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
            coord: new TileCoord(1, 0, 0),
            hasData: function() { return true; }
        };

        sourceCache._tiles[tile.coord.id] = tile;

        const retain = {};
        const expectedRetain = {};
        expectedRetain[tile.coord.id] = true;

        t.equal(sourceCache.findLoadedParent(new TileCoord(2, 3, 3), 0, retain), undefined);
        t.deepEqual(sourceCache.findLoadedParent(new TileCoord(2, 0, 0), 0, retain), tile);
        t.deepEqual(retain, expectedRetain);
        t.end();
    });

    t.test('retains parents', (t) => {
        const sourceCache = createSourceCache({});
        sourceCache.onAdd();
        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        const tile = new Tile(new TileCoord(1, 0, 0), 512, 22);
        sourceCache._cache.add(tile.coord.id, tile);

        const retain = {};
        const expectedRetain = {};
        expectedRetain[tile.coord.id] = true;

        t.equal(sourceCache.findLoadedParent(new TileCoord(2, 3, 3), 0, retain), undefined);
        t.equal(sourceCache.findLoadedParent(new TileCoord(2, 0, 0), 0, retain), tile);
        t.deepEqual(retain, expectedRetain);
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
        const coord = new TileCoord(1, 0, 0);

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
