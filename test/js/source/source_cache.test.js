'use strict';

var test = require('tap').test;
var SourceCache = require('../../../js/source/source_cache');
var TileCoord = require('../../../js/source/tile_coord');
var Transform = require('../../../js/geo/transform');
var LngLat = require('../../../js/geo/lng_lat');
var Coordinate = require('../../../js/geo/coordinate');
var util = require('../../../js/util/util');

test('SourceCache#coveringTiles', function(t) {
    var sourceCache = new SourceCache({
        minzoom: 1,
        maxzoom: 10,
        tileSize: 512
    });

    var transform = new Transform();
    transform.resize(200, 200);

    transform.zoom = 0;
    t.deepEqual(sourceCache.coveringTiles(transform), []);

    transform.zoom = 1;
    t.deepEqual(sourceCache.coveringTiles(transform), ['1', '33', '65', '97'].map(TileCoord.fromID));

    transform.zoom = 2.4;
    t.deepEqual(sourceCache.coveringTiles(transform), ['162', '194', '290', '322'].map(TileCoord.fromID));

    transform.zoom = 10;
    t.deepEqual(sourceCache.coveringTiles(transform), ['16760810', '16760842', '16793578', '16793610'].map(TileCoord.fromID));

    transform.zoom = 11;
    t.deepEqual(sourceCache.coveringTiles(transform), ['16760810', '16760842', '16793578', '16793610'].map(TileCoord.fromID));

    t.end();
});

test('SourceCache#coveringZoomLevel', function(t) {
    var sourceCache = new SourceCache({
        minzoom: 1,
        maxzoom: 10,
        tileSize: 512
    });

    var transform = new Transform();

    transform.zoom = 0;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 0);

    transform.zoom = 0.1;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 0);

    transform.zoom = 1;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 1);

    transform.zoom = 2.4;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 2);

    transform.zoom = 10;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 10);

    transform.zoom = 11;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 11);

    transform.zoom = 11.5;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 11);

    sourceCache.tileSize = 256;

    transform.zoom = 0;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 1);

    transform.zoom = 0.1;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 1);

    transform.zoom = 1;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 2);

    transform.zoom = 2.4;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 3);

    transform.zoom = 10;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 11);

    transform.zoom = 11;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 12);

    transform.zoom = 11.5;
    t.deepEqual(sourceCache.coveringZoomLevel(transform), 12);

    sourceCache.roundZoom = true;

    t.deepEqual(sourceCache.coveringZoomLevel(transform), 13);

    t.end();
});

function createPyramid(options) {
    return new SourceCache(util.extend({
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        load: function() {},
        abort: function() {},
        unload: function() {},
        add: function() {},
        remove: function() {}
    }, options));
}

test('SourceCache#addTile', function(t) {
    t.test('loads tile when uncached', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var sourceCache = createPyramid({
            load: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        sourceCache.addTile(coord);
    });

    t.test('adds tile when uncached', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var sourceCache = createPyramid({
            add: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 1);
                t.end();
            }
        });
        sourceCache.addTile(coord);
    });

    t.test('uses cached tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            load = 0,
            add = 0;

        var sourceCache = createPyramid({
            load: function(tile) { tile.state = 'loaded'; load++; },
            add: function() { add++; }
        });

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

        var sourceCache = createPyramid({
            load: function(tile) { tile.state = 'loaded'; load++; },
            add: function() { add++; }
        });

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
        var sourceCache = createPyramid({
            remove: function(tile) {
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
        var sourceCache = createPyramid({
            load: function(tile) {
                tile.state = 'loaded';
            },
            unload: function() {
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

        var sourceCache = createPyramid({
            abort: function(tile) {
                t.deepEqual(tile.coord, coord);
                abort++;
            },
            unload: function(tile) {
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

test('SourceCache#update', function(t) {
    t.test('loads no tiles if used is false', function(t) {
        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 0;

        var sourceCache = createPyramid({});
        sourceCache.update(false, transform);

        t.deepEqual(sourceCache.getIds(), []);
        t.end();
    });

    t.test('loads covering tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createPyramid({});
        sourceCache.update(true, transform);

        t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);
        t.end();
    });

    t.test('removes unused tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createPyramid({
            load: function(tile) {
                tile.state = 'loaded';
            }
        });

        sourceCache.update(true, transform);
        t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);

        transform.zoom = 1;
        sourceCache.update(true, transform);

        t.deepEqual(sourceCache.getIds(), [
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id
        ]);
        t.end();
    });

    t.test('retains parent tiles for pending children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createPyramid({
            load: function(tile) {
                if (tile.coord.id === new TileCoord(0, 0, 0).id) {
                    tile.state = 'loaded';
                }
            }
        });

        sourceCache.update(true, transform);
        t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0).id]);

        transform.zoom = 1;
        sourceCache.update(true, transform);

        t.deepEqual(sourceCache.getIds(), [
            new TileCoord(0, 0, 0).id,
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id
        ]);
        t.end();
    });

    t.test('retains parent tiles for pending children (wrapped)', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        transform.center = new LngLat(360, 0);

        var sourceCache = createPyramid({
            load: function(tile) {
                if (tile.coord.id === new TileCoord(0, 0, 0).id) {
                    tile.state = 'loaded';
                }
            }
        });

        sourceCache.update(true, transform);
        t.deepEqual(sourceCache.getIds(), [new TileCoord(0, 0, 0, 1).id]);

        transform.zoom = 1;
        sourceCache.update(true, transform);

        t.deepEqual(sourceCache.getIds(), [
            new TileCoord(0, 0, 0, 1).id,
            new TileCoord(1, 0, 0, 1).id,
            new TileCoord(1, 1, 0, 1).id,
            new TileCoord(1, 0, 1, 1).id,
            new TileCoord(1, 1, 1, 1).id
        ]);
        t.end();
    });

    t.test('includes partially covered tiles in rendered tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 2;

        var sourceCache = createPyramid({
            load: function(tile) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
            }
        });

        sourceCache.update(true, transform, 100);
        t.deepEqual(sourceCache.getIds(), [
            new TileCoord(2, 1, 1).id,
            new TileCoord(2, 2, 1).id,
            new TileCoord(2, 1, 2).id,
            new TileCoord(2, 2, 2).id
        ]);

        transform.zoom = 0;
        sourceCache.update(true, transform, 100);

        t.deepEqual(sourceCache.getRenderableIds().length, 5);
        t.end();
    });

    t.test('retains a parent tile for fading even if a tile is partially covered by children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var sourceCache = createPyramid({
            load: function(tile) {
                tile.timeAdded = Infinity;
                tile.state = 'loaded';
            }
        });

        sourceCache.update(true, transform, 100);

        transform.zoom = 2;
        sourceCache.update(true, transform, 100);

        transform.zoom = 1;
        sourceCache.update(true, transform, 100);

        t.equal(sourceCache._coveredTiles[(new TileCoord(0, 0, 0).id)], true);
        t.end();
    });


    t.test('retains overscaled loaded children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;
        transform.center = new LngLat(0, 0);

        var sourceCache = createPyramid({
            reparseOverscaled: true,
            load: function(tile) {
                if (tile.coord.z === 16) {
                    tile.state = 'loaded';
                }
            }
        });

        t.equal(sourceCache.maxzoom, 14);

        sourceCache.update(true, transform);
        t.deepEqual(sourceCache.getRenderableIds(), [
            new TileCoord(16, 8191, 8191, 0).id,
            new TileCoord(16, 8192, 8191, 0).id,
            new TileCoord(16, 8192, 8192, 0).id,
            new TileCoord(16, 8191, 8192, 0).id
        ]);

        transform.zoom = 15;
        sourceCache.update(true, transform);

        t.deepEqual(sourceCache.getRenderableIds(), [
            new TileCoord(16, 8191, 8191, 0).id,
            new TileCoord(16, 8192, 8191, 0).id,
            new TileCoord(16, 8192, 8192, 0).id,
            new TileCoord(16, 8191, 8192, 0).id
        ]);
        t.end();

    });

    t.end();
});

test('SourceCache#clearTiles', function(t) {
    t.test('unloads tiles', function(t) {
        var coord = new TileCoord(0, 0, 0),
            abort = 0,
            unload = 0;

        var sourceCache = createPyramid({
            abort: function(tile) {
                t.deepEqual(tile.coord, coord);
                abort++;
            },
            unload: function(tile) {
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
    t.test('regular tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        var sourceCache = createPyramid({
            load: function(tile) {
                tile.state = 'loaded';
            }
        });

        sourceCache.update(true, transform);

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

    t.test('reparsed overscaled tiles', function(t) {
        var sourceCache = createPyramid({
            load: function(tile) { tile.state = 'loaded'; },
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 2.0;
        sourceCache.update(true, transform);

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

    t.test('overscaled tiles', function(t) {
        var sourceCache = createPyramid({
            load: function(tile) { tile.state = 'loaded'; },
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 2.0;
        sourceCache.update(true, transform);


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
        t.equal(tiles[0].scale, 2);
        t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

        t.equal(tiles[1].tile.coord.id, 33);
        t.equal(tiles[1].tile.tileSize, 512);
        t.equal(tiles[1].scale, 2);
        t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

        t.end();
    });

    t.end();
});

test('SourceCache#loaded (no errors)', function (t) {
    var sourceCache = createPyramid({
        load: function(tile) {
            tile.state = 'loaded';
        }
    });

    var coord = new TileCoord(0, 0, 0);
    sourceCache.addTile(coord);

    t.ok(sourceCache.loaded());
    t.end();
});

test('SourceCache#loaded (with errors)', function (t) {
    var sourceCache = createPyramid({
        load: function(tile) {
            tile.state = 'errored';
        }
    });

    var coord = new TileCoord(0, 0, 0);
    sourceCache.addTile(coord);

    t.ok(sourceCache.loaded());
    t.end();
});

test('SourceCache#getIds (ascending order by zoom level)', function(t) {
    var ids = [
        new TileCoord(0, 0, 0),
        new TileCoord(3, 0, 0),
        new TileCoord(1, 0, 0),
        new TileCoord(2, 0, 0)
    ];

    var sourceCache = createPyramid({});
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
        var sourceCache = createPyramid({});
        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        sourceCache.updateCacheSize(tr);

        var tile = {
            coord: new TileCoord(1, 0, 0),
            isRenderable: function() { return true; }
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
        var sourceCache = createPyramid({});
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
