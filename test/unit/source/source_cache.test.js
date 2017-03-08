'use strict';

const test = require('mapbox-gl-js-test').test;
const SourceCache = require('../../../src/source/source_cache');
const AnimationLoop = require('../../../src/style/animation_loop');
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
        sourceCache.addTile(coord);
    });

    t.test('adds tile when uncached', (t) => {
        const coord = new TileCoord(0, 0, 0);
        const sourceCache = createSourceCache({})
        .on('dataloading', (data) => {
            t.deepEqual(data.tile.coord, coord);
            t.equal(data.tile.uses, 1);
            t.end();
        });
        sourceCache.onAdd();
        sourceCache.addTile(coord);
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
        })
        .on('dataloading', () => { add++; });

        const tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);
        sourceCache.addTile(coord);
        sourceCache.removeTile(coord.id);
        sourceCache.addTile(coord);

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
        sourceCache.loadTile = (tile, callback) => {
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

        sourceCache.addTile(coord);

        t.ok(sourceCache._timers[id]);
        t.notOk(sourceCache._cacheTimers[id]);

        sourceCache.removeTile(coord.id);

        t.notOk(sourceCache._timers[id]);
        t.ok(sourceCache._cacheTimers[id]);

        sourceCache.addTile(coord);

        t.ok(sourceCache._timers[id]);
        t.notOk(sourceCache._cacheTimers[id]);

        t.end();
    });

    t.test('reuses wrapped tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
        let load = 0,
            add = 0;

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        })
        .on('dataloading', () => { add++; });

        const t1 = sourceCache.addTile(coord);
        const t2 = sourceCache.addTile(new TileCoord(0, 0, 0, 1));

        t.equal(load, 1);
        t.equal(add, 1);
        t.equal(t1, t2);

        t.end();
    });

    t.end();
});

test('SourceCache#removeTile', (t) => {
    t.test('removes tile', (t) => {
        const coord = new TileCoord(0, 0, 0);
        const sourceCache = createSourceCache({});
        sourceCache.addTile(coord);
        sourceCache.on('data', ()=> {
            sourceCache.removeTile(coord.id);
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

        sourceCache.addTile(coord);
        sourceCache.removeTile(coord.id);

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

        sourceCache.addTile(coord);
        sourceCache.removeTile(coord.id);

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
        const sourceCache = createSourceCache({ error: 'Error loading source' })
        .on('error', (err) => {
            t.equal(err.error, 'Error loading source');
            t.end();
        });
        sourceCache.onAdd();
    });

    t.test('loaded() true after error', (t) => {
        const sourceCache = createSourceCache({ error: 'Error loading source' })
        .on('error', () => {
            t.ok(sourceCache.loaded());
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

    t.test('removes unused tiles', (t) => {
        const transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        const sourceCache = createSourceCache({});

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);

                transform.zoom = 1;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getIds(), [
                    new TileCoord(1, 0, 0).id,
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 0, 1).id,
                    new TileCoord(1, 1, 1).id
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
                    new TileCoord(1, 0, 0).id,
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 0, 1).id,
                    new TileCoord(1, 1, 1).id
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
                tile.state = (tile.coord.id === new TileCoord(0, 0, 0).id) ? 'loaded' : 'loading';
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
                    new TileCoord(1, 0, 0, 1).id,
                    new TileCoord(1, 1, 0, 1).id,
                    new TileCoord(1, 0, 1, 1).id,
                    new TileCoord(1, 1, 1, 1).id
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
        const animationLoop = new AnimationLoop();

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(animationLoop, 100);
                callback();
            }
        });

        sourceCache._source.type = 'raster';

        sourceCache.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                sourceCache.update(transform);
                t.deepEqual(sourceCache.getIds(), [
                    new TileCoord(2, 1, 1).id,
                    new TileCoord(2, 2, 1).id,
                    new TileCoord(2, 1, 2).id,
                    new TileCoord(2, 2, 2).id
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

        const animationLoop = new AnimationLoop();

        const sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                tile.registerFadeDuration(animationLoop, 100);
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
                    new TileCoord(16, 8191, 8191, 0).id,
                    new TileCoord(16, 8192, 8191, 0).id,
                    new TileCoord(16, 8191, 8192, 0).id,
                    new TileCoord(16, 8192, 8192, 0).id
                ]);

                transform.zoom = 15;
                sourceCache.update(transform);

                t.deepEqual(sourceCache.getRenderableIds(), [
                    new TileCoord(16, 8191, 8191, 0).id,
                    new TileCoord(16, 8192, 8191, 0).id,
                    new TileCoord(16, 8191, 8192, 0).id,
                    new TileCoord(16, 8192, 8192, 0).id
                ]);
                t.end();
            }
        });
        sourceCache.onAdd();
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

        sourceCache.addTile(coord);
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
                    new TileCoord(1, 0, 0).id,
                    new TileCoord(1, 1, 0).id,
                    new TileCoord(1, 0, 1).id,
                    new TileCoord(1, 1, 1).id
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
                    new TileCoord(2, 0, 0).id,
                    new TileCoord(2, 1, 0).id,
                    new TileCoord(2, 0, 1).id,
                    new TileCoord(2, 1, 1).id
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
            sourceCache.addTile(coord);

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
            sourceCache.addTile(coord);

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

        sourceCache.reloadTile = (id, state) => {
            t.equal(state, 'expired');
            t.end();
        };

        sourceCache.addTile(coord);
    });

    t.end();
});
