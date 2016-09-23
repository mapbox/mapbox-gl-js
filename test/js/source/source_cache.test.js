'use strict';

var test = require('tap').test;
var SourceCache = require('../../../js/source/source_cache');
var Source = require('../../../js/source/source');
var TileCoord = require('../../../js/source/tile_coord');
var Transform = require('../../../js/geo/transform');
var LngLat = require('../../../js/geo/lng_lat');
var Coordinate = require('../../../js/geo/coordinate');
var Evented = require('../../../js/util/evented');
var util = require('../../../js/util/util');

// Add a mocked source type for use in these tests
Source.setType('mock-source-type', function create (id, sourceOptions) {
    // allow tests to override mocked methods/properties by providing
    // them in the source definition object that's given to Source.create()
    var source = util.extend({
        id: id,
        minzoom: 0,
        maxzoom: 22,
        loadTile: function (tile, callback) {
            setTimeout(callback, 0);
        },
        abortTile: function () {},
        unloadTile: function () {},
        serialize: function () {}
    }, sourceOptions);
    source = util.inherit(Evented, source);

    if (sourceOptions.noLoad) { return source; }
    setTimeout(function () {
        if (sourceOptions.error) {
            source.fire('error', { error: sourceOptions.error });
        } else {
            source.fire('sourceload');
        }
    }, 0);
    return source;
});

function createSourceCache(options, used) {
    var sc = new SourceCache('id', util.extend({
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        type: 'mock-source-type'
    }, options), /* dispatcher */ {});
    sc.used = typeof used === 'boolean' ? used : true;
    return sc;
}

test('SourceCache#attribution is set', function(t) {
    var sourceCache = createSourceCache({
        attribution: 'Mapbox Heavy Industries'
    });
    sourceCache.on('sourceload', function() {
        t.equal(sourceCache.attribution, 'Mapbox Heavy Industries');
        t.end();
    });
});

test('SourceCache#addTile', function(t) {
    t.test('loads tile when uncached', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var sourceCache = createSourceCache({
            loadTile: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        sourceCache.addTile(coord);
    });

    t.test('adds tile when uncached', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var sourceCache = createSourceCache({})
        .on('dataloading', function (data) {
            t.deepEqual(data.tile.coord, coord);
            t.equal(data.tile.uses, 1);
            t.end();
        });
        sourceCache.addTile(coord);
    });

    t.test('uses cached tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            load = 0,
            add = 0;

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        })
        .on('dataloading', function () { add++; });

        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);
        sourceCache.addTile(coord);
        sourceCache.removeTile(coord.id);
        sourceCache.addTile(coord);

        t.equal(load, 1);
        t.equal(add, 2);

        t.end();
    });

    t.test('reuses wrapped tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            load = 0,
            add = 0;

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                load++;
                callback();
            }
        })
        .on('dataloading', function () { add++; });

        var t1 = sourceCache.addTile(coord);
        var t2 = sourceCache.addTile(new TileCoord(0, 0, 0, 1));

        t.equal(load, 1);
        t.equal(add, 2);
        t.equal(t1, t2);

        t.end();
    });

    t.end();
});

test('SourceCache#removeTile', function(t) {
    t.test('removes tile', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var sourceCache = createSourceCache({});
        sourceCache.on('data', function (event) {
            if (event.isDataRemoved) {
                var tile = event.tile;
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        sourceCache.addTile(coord);
        sourceCache.removeTile(coord.id);
    });

    t.test('caches (does not unload) loaded tile', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var sourceCache = createSourceCache({
            loadTile: function(tile) {
                tile.state = 'loaded';
            },
            unloadTile: function() {
                t.fail();
            }
        });

        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        sourceCache.addTile(coord);
        sourceCache.removeTile(coord.id);

        t.end();
    });

    t.test('aborts and unloads unfinished tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            abort = 0,
            unload = 0;

        var sourceCache = createSourceCache({
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

test('SourceCache / Source lifecycle', function (t) {
    t.test('does not fire load or change before source load event', function (t) {
        createSourceCache({noLoad: true})
            .on('sourceload', t.fail)
            .on('data', t.fail);
        setTimeout(t.end, 1);
    });

    t.test('forward load event', function (t) {
        createSourceCache({}).on('sourceload', t.end);
    });

    t.test('forward change event', function (t) {
        var sourceCache = createSourceCache().on('data', t.end);
        sourceCache.getSource().fire('data');
    });

    t.test('forward error event', function (t) {
        createSourceCache({ error: 'Error loading source' })
        .on('error', function (err) {
            t.equal(err.error, 'Error loading source');
            t.end();
        });
    });

    t.test('loaded() true after error', function (t) {
        var sourceCache = createSourceCache({ error: 'Error loading source' })
        .on('error', function () {
            t.ok(sourceCache.loaded());
            t.end();
        });
    });

    t.test('reloads tiles after a geoJSON data event', function (t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var expected = [ new TileCoord(0, 0, 0).id, new TileCoord(0, 0, 0).id ];
        t.plan(expected.length);

        var sourceCache = createSourceCache({
            loadTile: function (tile, callback) {
                t.equal(tile.coord.id, expected.shift());
                tile.loaded = true;
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
            sourceCache.update(transform);
            sourceCache.getSource().fire('data', {dataType: 'geoJSON'});
        });
    });

    t.end();
});

test('SourceCache#update', function(t) {
    t.test('loads no tiles if used is false', function(t) {
        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 0;

        var sourceCache = createSourceCache({}, false);
        sourceCache.on('sourceload', function () {
            sourceCache.update(transform);

            t.deepEqual(sourceCache.getIds(), []);
            t.end();
        });
    });

    t.test('loads covering tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createSourceCache({});
        sourceCache.on('sourceload', function () {
            sourceCache.update(transform);
            t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);
            t.end();
        });
    });

    t.test('removes unused tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createSourceCache({
            load: function(tile) {
                tile.state = 'loaded';
            }
        });

        sourceCache.on('sourceload', function () {
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
        });
    });


    t.test('retains parent tiles for pending children', function(t) {
        var transform = new Transform();
        transform._test = 'retains';
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = (tile.coord.id === new TileCoord(0, 0, 0).id) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
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
        });
    });

    t.test('retains parent tiles for pending children (wrapped)', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        transform.center = new LngLat(360, 0);

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = (tile.coord.id === new TileCoord(0, 0, 0).id) ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
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
        });
    });

    t.test('includes partially covered tiles in rendered tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 2;

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
            sourceCache.update(transform, 100);
            t.deepEqual(sourceCache.getIds(), [
                new TileCoord(2, 1, 1).id,
                new TileCoord(2, 2, 1).id,
                new TileCoord(2, 1, 2).id,
                new TileCoord(2, 2, 2).id
            ]);

            transform.zoom = 0;
            sourceCache.update(transform, 100);

            t.deepEqual(sourceCache.getRenderableIds().length, 5);
            t.end();
        });
    });

    t.test('retains a parent tile for fading even if a tile is partially covered by children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
            sourceCache.update(transform, 100);

            transform.zoom = 2;
            sourceCache.update(transform, 100);

            transform.zoom = 1;
            sourceCache.update(transform, 100);

            t.equal(sourceCache._coveredTiles[(new TileCoord(0, 0, 0).id)], true);
            t.end();
        });
    });


    t.test('retains overscaled loaded children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;
        transform.center = new LngLat(0, 0);


        var sourceCache = createSourceCache({
            reparseOverscaled: true,
            loadTile: function(tile, callback) {
                tile.state = tile.coord.z === 16 ? 'loaded' : 'loading';
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
            t.equal(sourceCache.maxzoom, 14);

            sourceCache.update(transform);
            t.deepEqual(sourceCache.getRenderableIds(), [
                new TileCoord(16, 8191, 8191, 0).id,
                new TileCoord(16, 8192, 8191, 0).id,
                new TileCoord(16, 8192, 8192, 0).id,
                new TileCoord(16, 8191, 8192, 0).id
            ]);

            transform.zoom = 15;
            sourceCache.update(transform);

            t.deepEqual(sourceCache.getRenderableIds(), [
                new TileCoord(16, 8191, 8191, 0).id,
                new TileCoord(16, 8192, 8191, 0).id,
                new TileCoord(16, 8192, 8192, 0).id,
                new TileCoord(16, 8191, 8192, 0).id
            ]);
            t.end();
        });
    });

    t.end();
});

test('SourceCache#clearTiles', function(t) {
    t.test('unloads tiles', function(t) {
        var coord = new TileCoord(0, 0, 0),
            abort = 0,
            unload = 0;

        var sourceCache = createSourceCache({
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
        sourceCache.clearTiles();

        t.equal(abort, 1);
        t.equal(unload, 1);

        t.end();
    });

    t.end();
});

test('SourceCache#tilesIn', function (t) {
    t.test('graceful response before source loaded', function (t) {
        var sourceCache = createSourceCache({ noLoad: true });
        t.same(sourceCache.tilesIn([
            new Coordinate(0.5, 0.25, 1),
            new Coordinate(1.5, 0.75, 1)
        ]), []);

        t.end();
    });

    t.test('regular tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) {
                tile.state = 'loaded';
                callback();
            }
        });

        sourceCache.on('sourceload', function () {
            sourceCache.update(transform);

            t.deepEqual(sourceCache.getIds(), [
                new TileCoord(1, 0, 0).id,
                new TileCoord(1, 1, 0).id,
                new TileCoord(1, 0, 1).id,
                new TileCoord(1, 1, 1).id
            ]);

            var tiles = sourceCache.tilesIn([
                new Coordinate(0.5, 0.25, 1),
                new Coordinate(1.5, 0.75, 1)
            ]);

            tiles.sort(function (a, b) { return a.tile.coord.x - b.tile.coord.x; });
            tiles.forEach(function (result) { delete result.tile.uid; });

            t.equal(tiles[0].tile.coord.id, 1);
            t.equal(tiles[0].tile.tileSize, 512);
            t.equal(tiles[0].scale, 1);
            t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

            t.equal(tiles[1].tile.coord.id, 33);
            t.equal(tiles[1].tile.tileSize, 512);
            t.equal(tiles[1].scale, 1);
            t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

            t.end();
        });
    });

    t.test('reparsed overscaled tiles', function(t) {
        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) { tile.state = 'loaded'; callback(); },
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        sourceCache.on('sourceload', function () {
            var transform = new Transform();
            transform.resize(512, 512);
            transform.zoom = 2.0;
            sourceCache.update(transform);

            t.deepEqual(sourceCache.getIds(), [
                new TileCoord(2, 0, 0).id,
                new TileCoord(2, 1, 0).id,
                new TileCoord(2, 0, 1).id,
                new TileCoord(2, 1, 1).id
            ]);

            var tiles = sourceCache.tilesIn([
                new Coordinate(0.5, 0.25, 1),
                new Coordinate(1.5, 0.75, 1)
            ]);

            tiles.sort(function (a, b) { return a.tile.coord.x - b.tile.coord.x; });
            tiles.forEach(function (result) { delete result.tile.uid; });

            t.equal(tiles[0].tile.coord.id, 2);
            t.equal(tiles[0].tile.tileSize, 1024);
            t.equal(tiles[0].scale, 1);
            t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

            t.equal(tiles[1].tile.coord.id, 34);
            t.equal(tiles[1].tile.tileSize, 1024);
            t.equal(tiles[1].scale, 1);
            t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

            t.end();
        });
    });

    t.test('overscaled tiles', function(t) {
        var sourceCache = createSourceCache({
            loadTile: function(tile, callback) { tile.state = 'loaded'; callback(); },
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        sourceCache.on('sourceload', function () {
            var transform = new Transform();
            transform.resize(512, 512);
            transform.zoom = 2.0;
            sourceCache.update(transform);


            t.end();
        });
    });

    t.end();
});

test('SourceCache#loaded (no errors)', function (t) {
    var sourceCache = createSourceCache({
        loadTile: function(tile, callback) {
            tile.state = 'loaded';
            callback();
        }
    });

    sourceCache.on('sourceload', function () {
        var coord = new TileCoord(0, 0, 0);
        sourceCache.addTile(coord);

        t.ok(sourceCache.loaded());
        t.end();
    });
});

test('SourceCache#loaded (with errors)', function (t) {
    var sourceCache = createSourceCache({
        loadTile: function(tile) {
            tile.state = 'errored';
        }
    });

    sourceCache.on('sourceload', function () {
        var coord = new TileCoord(0, 0, 0);
        sourceCache.addTile(coord);

        t.ok(sourceCache.loaded());
        t.end();
    });
});

test('SourceCache#getIds (ascending order by zoom level)', function(t) {
    var ids = [
        new TileCoord(0, 0, 0),
        new TileCoord(3, 0, 0),
        new TileCoord(1, 0, 0),
        new TileCoord(2, 0, 0)
    ];

    var sourceCache = createSourceCache({});
    for (var i = 0; i < ids.length; i++) {
        sourceCache._tiles[ids[i].id] = {};
    }
    t.deepEqual(sourceCache.getIds(), [
        new TileCoord(0, 0, 0).id,
        new TileCoord(1, 0, 0).id,
        new TileCoord(2, 0, 0).id,
        new TileCoord(3, 0, 0).id
    ]);
    t.end();
});


test('SourceCache#findLoadedParent', function(t) {

    t.test('adds from previously used tiles (sourceCache._tiles)', function(t) {
        var sourceCache = createSourceCache({});
        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        var tile = {
            coord: new TileCoord(1, 0, 0),
            hasData: function() { return true; }
        };

        sourceCache._tiles[tile.coord.id] = tile;

        var retain = {};
        var expectedRetain = {};
        expectedRetain[tile.coord.id] = true;

        t.equal(sourceCache.findLoadedParent(new TileCoord(2, 3, 3), 0, retain), undefined);
        t.deepEqual(sourceCache.findLoadedParent(new TileCoord(2, 0, 0), 0, retain), tile);
        t.deepEqual(retain, expectedRetain);
        t.end();
    });

    t.test('adds from cache', function(t) {
        var sourceCache = createSourceCache({});
        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        var tile = {
            coord: new TileCoord(1, 0, 0),
            loaded: true
        };

        sourceCache._cache.add(tile.coord.id, tile);

        var retain = {};
        var expectedRetain = {};
        expectedRetain[tile.coord.id] = true;

        t.equal(sourceCache.findLoadedParent(new TileCoord(2, 3, 3), 0, retain), undefined);
        t.equal(sourceCache.findLoadedParent(new TileCoord(2, 0, 0), 0, retain), tile);
        t.deepEqual(retain, expectedRetain);
        t.equal(sourceCache._cache.order.length, 0);
        t.equal(sourceCache._tiles[tile.coord.id], tile);

        t.end();
    });

    t.end();
});

test('SourceCache#reload', function(t) {
    t.test('before loaded', function(t) {
        var sourceCache = createSourceCache({ noLoad: true });

        t.doesNotThrow(function() {
            sourceCache.reload();
        }, null, 'reload ignored gracefully');

        t.end();
    });

    t.end();
});
